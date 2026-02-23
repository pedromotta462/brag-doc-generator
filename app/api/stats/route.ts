import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// GET /api/stats — aggregated metrics for charts
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const userId = authResult.userId;

  const commits = await prisma.commit.findMany({
    where: { project: { userId } },
    select: { date: true, repoName: true, message: true, project: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  // Commits per day (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const commitsPerDay: Record<string, number> = {};
  const recentCommits = commits.filter((c) => c.date >= thirtyDaysAgo);
  for (const c of recentCommits) {
    const day = c.date.toISOString().split("T")[0];
    commitsPerDay[day] = (commitsPerDay[day] || 0) + 1;
  }

  // Fill in missing days with 0
  const activityData: { date: string; commits: number }[] = [];
  const cursor = new Date(thirtyDaysAgo);
  const today = new Date();
  while (cursor <= today) {
    const key = cursor.toISOString().split("T")[0];
    activityData.push({ date: key, commits: commitsPerDay[key] || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Commits per repo
  const repoMap: Record<string, number> = {};
  for (const c of commits) {
    const repo = c.repoName || "unknown";
    repoMap[repo] = (repoMap[repo] || 0) + 1;
  }
  const commitsPerRepo = Object.entries(repoMap)
    .map(([name, commits]) => ({ name, commits }))
    .sort((a, b) => b.commits - a.commits);

  // Commits per project
  const projectMap: Record<string, number> = {};
  for (const c of commits) {
    const proj = c.project.name;
    projectMap[proj] = (projectMap[proj] || 0) + 1;
  }
  const commitsPerProject = Object.entries(projectMap)
    .map(([name, commits]) => ({ name, commits }))
    .sort((a, b) => b.commits - a.commits);

  // Day of week distribution
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeekMap: Record<string, number> = {};
  for (const d of dayNames) dayOfWeekMap[d] = 0;
  for (const c of commits) {
    const day = dayNames[c.date.getDay()];
    dayOfWeekMap[day]++;
  }
  const commitsByDayOfWeek = dayNames.map((name) => ({
    name,
    commits: dayOfWeekMap[name],
  }));

  // Repositories with recent commit summaries
  const repoDetails: {
    name: string;
    project: string;
    commits: number;
    lastCommitDate: string;
    recentMessages: string[];
    workSummary: string;
  }[] = [];

  const repoGrouped: Record<
    string,
    { project: string; commits: number; lastDate: Date; allMessages: string[] }
  > = {};

  for (const c of commits) {
    const repo = c.repoName || "unknown";
    if (!repoGrouped[repo]) {
      repoGrouped[repo] = {
        project: c.project.name,
        commits: 0,
        lastDate: c.date,
        allMessages: [],
      };
    }
    repoGrouped[repo].commits++;
    if (c.date > repoGrouped[repo].lastDate) {
      repoGrouped[repo].lastDate = c.date;
    }
    repoGrouped[repo].allMessages.push(c.message);
  }

  const cachedSummaries = await prisma.repoSummary.findMany({
    where: { userId },
  });
  const summaryMap: Record<string, string> = {};
  for (const s of cachedSummaries) summaryMap[s.repoName] = s.summary;

  for (const [name, data] of Object.entries(repoGrouped)) {
    repoDetails.push({
      name,
      project: data.project,
      commits: data.commits,
      lastCommitDate: data.lastDate.toISOString(),
      recentMessages: data.allMessages.slice(-5).reverse(),
      workSummary: summaryMap[name] || buildWorkSummary(data.allMessages),
    });
  }
  repoDetails.sort((a, b) => b.commits - a.commits);

  const hasAiSummaries = cachedSummaries.length > 0;

  return NextResponse.json({
    activityData,
    commitsPerRepo,
    commitsPerProject,
    commitsByDayOfWeek,
    repositories: repoDetails,
    totalCommits: commits.length,
    totalRepos: Object.keys(repoMap).length,
    hasAiSummaries,
  });
}

function buildWorkSummary(messages: string[]): string {
  const categories: Record<string, number> = {
    features: 0,
    fixes: 0,
    refactoring: 0,
    chores: 0,
    docs: 0,
    tests: 0,
    other: 0,
  };

  const patterns: [RegExp, keyof typeof categories][] = [
    [/^feat(\(.+\))?[!:]|^add[:\s]|^implement|^new[\s:]/i, "features"],
    [/^fix(\(.+\))?[!:]|^bugfix|^hotfix|^patch/i, "fixes"],
    [/^refactor(\(.+\))?[!:]|^cleanup|^clean up|^reorganize|^simplif/i, "refactoring"],
    [/^chore(\(.+\))?[!:]|^build|^ci(\(.+\))?[!:]|^deps|^bump|^update dep|^upgrade/i, "chores"],
    [/^docs?(\(.+\))?[!:]|^readme|^comment/i, "docs"],
    [/^test(\(.+\))?[!:]|^spec/i, "tests"],
  ];

  for (const msg of messages) {
    const trimmed = msg.trim();
    let matched = false;
    for (const [regex, cat] of patterns) {
      if (regex.test(trimmed)) {
        categories[cat]++;
        matched = true;
        break;
      }
    }
    if (!matched) categories.other++;
  }

  const parts: string[] = [];
  if (categories.features > 0) parts.push(`${categories.features} new features`);
  if (categories.fixes > 0) parts.push(`${categories.fixes} bug fixes`);
  if (categories.refactoring > 0) parts.push(`${categories.refactoring} refactors`);
  if (categories.chores > 0) parts.push(`${categories.chores} chores/maintenance`);
  if (categories.docs > 0) parts.push(`${categories.docs} doc updates`);
  if (categories.tests > 0) parts.push(`${categories.tests} test changes`);
  if (categories.other > 0 && parts.length > 0) parts.push(`${categories.other} other changes`);

  if (parts.length === 0) return `${messages.length} commits with various changes.`;

  return parts.join(", ") + ".";
}
