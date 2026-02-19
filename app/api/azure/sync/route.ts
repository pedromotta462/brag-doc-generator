import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { syncAllCommits } from "@/lib/azure-devops";

// POST /api/azure/sync - Sync commits from Azure DevOps
export async function POST() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const userId = authResult.userId;

  try {
    const config = await prisma.azureConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return NextResponse.json(
        { message: "Azure DevOps configuration not found. Please configure it in Settings." },
        { status: 400 }
      );
    }

    const userAliases: string[] = JSON.parse(config.userAliases || "[]");
    const results = await syncAllCommits(config.organization, config.pat, userAliases);

    let totalCommitsSynced = 0;

    for (const { project, commits } of results) {
      // Upsert project
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

      // Upsert commits
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

    return NextResponse.json({
      message: "Sync complete",
      commitsSynced: totalCommitsSynced,
      projectsSynced: results.length,
    });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Failed to sync";
    return NextResponse.json({ message }, { status: 500 });
  }
}
