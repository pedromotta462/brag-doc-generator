import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// GET /api/projects - List all synced projects with commit counts
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const projects = await prisma.project.findMany({
    where: { userId: authResult.userId },
    include: {
      _count: {
        select: { commits: true },
      },
    },
    orderBy: { lastSyncedAt: "desc" },
  });

  return NextResponse.json(projects);
}
