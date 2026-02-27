import { prisma } from "@/lib/prisma";
import { getDecryptedConfig } from "@/lib/config-helpers";
import { syncAllCommits } from "@/lib/azure-devops";
import { log } from "@/lib/logger";

export interface SyncResult {
  userId: string;
  commitsSynced: number;
  projectsSynced: number;
  error?: string;
}

/**
 * Syncs Azure DevOps commits for a single user.
 * Used by both manual sync (POST /api/azure/sync) and cron job.
 */
export async function syncUserCommits(userId: string): Promise<SyncResult> {
  try {
    const config = await getDecryptedConfig(userId);
    if (!config) {
      log.debug("Sync", "No config for user", { userId });
      return { userId, commitsSynced: 0, projectsSynced: 0 };
    }

    const userAliases: string[] = JSON.parse(config.userAliases || "[]");
    log.debug("Sync", "Fetching from Azure", {
      userId,
      organization: config.organization,
      aliasCount: userAliases.length,
    });
    const results = await syncAllCommits(
      config.organization,
      config.pat,
      userAliases
    );

    let totalCommitsSynced = 0;

    for (const { project, commits } of results) {
      const dbProject = await prisma.project.upsert({
        where: {
          userId_azureId: {
            userId,
            azureId: project.id,
          },
        },
        update: {
          name: project.name,
          description: project.description || null,
          lastSyncedAt: new Date(),
        },
        create: {
          userId,
          azureId: project.id,
          name: project.name,
          description: project.description || null,
          lastSyncedAt: new Date(),
        },
      });

      for (const commit of commits) {
        await prisma.commit.upsert({
          where: {
            projectId_hash: {
              projectId: dbProject.id,
              hash: commit.hash,
            },
          },
          update: {
            message: commit.message,
            authorName: commit.authorName,
            authorEmail: commit.authorEmail,
            date: new Date(commit.date),
            url: commit.url || null,
            repoName: commit.repoName,
          },
          create: {
            projectId: dbProject.id,
            hash: commit.hash,
            message: commit.message,
            authorName: commit.authorName,
            authorEmail: commit.authorEmail,
            date: new Date(commit.date),
            url: commit.url || null,
            repoName: commit.repoName,
          },
        });
        totalCommitsSynced++;
      }
    }

    log.debug("Sync", "User sync complete", {
      userId,
      commitsSynced: totalCommitsSynced,
      projectsSynced: results.length,
    });

    return {
      userId,
      commitsSynced: totalCommitsSynced,
      projectsSynced: results.length,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Sync", "User sync failed", { userId, error: message });
    return {
      userId,
      commitsSynced: 0,
      projectsSynced: 0,
      error: message,
    };
  }
}
