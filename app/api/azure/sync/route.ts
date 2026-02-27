import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { syncUserCommits } from "@/lib/sync-service";
import { log } from "@/lib/logger";

// POST /api/azure/sync - Sync commits from Azure DevOps (manual sync)
export async function POST() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const userId = authResult.userId;
  log.info("Sync", "Manual sync started", { userId });

  const result = await syncUserCommits(userId);

  if (result.error) {
    log.error("Sync", "Manual sync failed", { userId, error: result.error });
    return NextResponse.json(
      { message: result.error },
      { status: 500 }
    );
  }

  if (result.commitsSynced === 0 && result.projectsSynced === 0) {
    log.warn("Sync", "No config or no commits", { userId });
    return NextResponse.json(
      { message: "Azure DevOps configuration not found. Please configure it in Settings." },
      { status: 400 }
    );
  }

  log.info("Sync", "Manual sync complete", {
    userId,
    commitsSynced: result.commitsSynced,
    projectsSynced: result.projectsSynced,
  });

  return NextResponse.json({
    message: "Sync complete",
    commitsSynced: result.commitsSynced,
    projectsSynced: result.projectsSynced,
  });
}
