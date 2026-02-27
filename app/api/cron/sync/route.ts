import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { syncUserCommits } from "@/lib/sync-service";
import { log } from "@/lib/logger";

function secureCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * GET /api/cron/sync
 * Scheduled sync for all users with Azure config. Runs daily at 1 AM.
 * Protected by CRON_SECRET (Authorization: Bearer <secret> or x-cron-secret header).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log.error("Cron", "CRON_SECRET not configured");
    return NextResponse.json(
      { error: "Cron not configured" },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;
  const headerSecret = req.headers.get("x-cron-secret")?.trim();

  const providedSecret = bearerToken || headerSecret;
  if (!providedSecret || !secureCompare(providedSecret, secret)) {
    log.warn("Cron", "Unauthorized cron attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  log.info("Cron", "Sync job started");

  const configs = await prisma.azureConfig.findMany({
    select: { userId: true },
  });

  if (configs.length === 0) {
    log.info("Cron", "No users to sync");
    return NextResponse.json({
      message: "No users to sync",
      usersSynced: 0,
      results: [],
    });
  }

  log.debug("Cron", "Syncing users", { userCount: configs.length });

  const results = await Promise.all(
    configs.map((c) => syncUserCommits(c.userId))
  );

  const totalCommits = results.reduce((acc, r) => acc + r.commitsSynced, 0);
  const failed = results.filter((r) => r.error);

  log.info("Cron", "Sync job complete", {
    usersSynced: configs.length,
    totalCommitsSynced: totalCommits,
    failedCount: failed.length,
  });
  if (failed.length > 0) {
    log.warn("Cron", "Some users failed", {
      failedUserIds: failed.map((r) => r.userId),
      errors: failed.map((r) => r.error),
    });
  }

  return NextResponse.json({
    message: "Cron sync complete",
    usersSynced: configs.length,
    totalCommitsSynced: totalCommits,
    failedCount: failed.length,
    results: results.map((r) => ({
      userId: r.userId,
      commitsSynced: r.commitsSynced,
      projectsSynced: r.projectsSynced,
      error: r.error,
    })),
  });
}
