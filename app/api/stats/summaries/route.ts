import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import {
  generateRepoSummaries,
  type RepoCommitsForSummary,
} from "@/lib/ai-service";

// GET /api/stats/summaries — returns cached AI summaries
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const summaries = await prisma.repoSummary.findMany({
    where: { userId: authResult.userId },
  });

  const map: Record<string, string> = {};
  for (const s of summaries) map[s.repoName] = s.summary;

  return NextResponse.json(map);
}

// POST /api/stats/summaries — generate AI summaries for all repos
export async function POST() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const config = await prisma.azureConfig.findUnique({ where: { userId } });
  if (!config || !config.aiApiKey) {
    return NextResponse.json(
      { error: "AI provider not configured. Go to Settings to set it up." },
      { status: 400 }
    );
  }

  const commits = await prisma.commit.findMany({
    where: { project: { userId } },
    select: {
      message: true,
      repoName: true,
      project: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  const repoGroup: Record<
    string,
    { projectName: string; messages: string[] }
  > = {};
  for (const c of commits) {
    const repo = c.repoName || "unknown";
    if (!repoGroup[repo]) {
      repoGroup[repo] = { projectName: c.project.name, messages: [] };
    }
    repoGroup[repo].messages.push(c.message);
  }

  const repos: RepoCommitsForSummary[] = Object.entries(repoGroup).map(
    ([repoName, data]) => ({
      repoName,
      projectName: data.projectName,
      messages: data.messages,
    })
  );

  const aiSummaries = await generateRepoSummaries(
    {
      provider: config.aiProvider as "openai" | "claude" | "gemini" | "deepseek",
      apiKey: config.aiApiKey,
      model: config.aiModel,
    },
    repos
  );

  for (const [repoName, summary] of Object.entries(aiSummaries)) {
    const projectName =
      repoGroup[repoName]?.projectName || "unknown";
    await prisma.repoSummary.upsert({
      where: { userId_repoName: { userId, repoName } },
      update: { summary, projectName, generatedAt: new Date() },
      create: { userId, repoName, projectName, summary },
    });
  }

  return NextResponse.json(aiSummaries);
}
