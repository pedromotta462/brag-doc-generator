import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// GET /api/projects - List all synced projects with commit counts and latest commit date
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const projects = await prisma.project.findMany({
    where: { userId: authResult.userId },
    include: {
      _count: {
        select: { commits: true },
      },
      commits: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
    orderBy: { lastSyncedAt: "desc" },
  });

  const result = projects.map(({ commits, ...project }) => ({
    ...project,
    lastCommitDate: commits[0]?.date ?? null,
  }));

  return NextResponse.json(result);
}
