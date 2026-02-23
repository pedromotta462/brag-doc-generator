import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import {
  generateDailyInsights,
  type AIProviderConfig,
} from "@/lib/ai-service";

function getWeekRange(): { monday: Date; friday: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);
  return { monday, friday };
}

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

// GET /api/insights?date=YYYY-MM-DD
// If no date, returns week overview (which days have commits + cached insights)
export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;
  const userId = authResult.userId;

  const dateParam = req.nextUrl.searchParams.get("date");

  if (dateParam) {
    const cached = await prisma.dailyInsight.findUnique({
      where: { userId_date: { userId, date: dateParam } },
    });

    if (cached) {
      return NextResponse.json({
        todaysFocus: cached.todaysFocus,
        recentAchievements: JSON.parse(cached.recentAchievements),
        suggestedStandup: cached.suggestedStandup,
        cachedAt: cached.createdAt,
      });
    }

    return generateAndCache(userId, dateParam);
  }

  const { monday, friday } = getWeekRange();

  const commits = await prisma.commit.findMany({
    where: {
      project: { userId },
      date: { gte: monday, lte: friday },
    },
    select: { date: true },
  });

  const daysWithCommits = new Set<string>();
  for (const c of commits) {
    daysWithCommits.add(toDateStr(c.date));
  }

  const cachedInsights = await prisma.dailyInsight.findMany({
    where: {
      userId,
      date: {
        gte: toDateStr(monday),
        lte: toDateStr(friday),
      },
    },
    select: { date: true },
  });

  const cachedDays = new Set(cachedInsights.map((c) => c.date));

  const weekDays: {
    date: string;
    dayName: string;
    hasCommits: boolean;
    hasCachedInsight: boolean;
  }[] = [];

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = toDateStr(d);
    weekDays.push({
      date: dateStr,
      dayName: dayNames[i],
      hasCommits: daysWithCommits.has(dateStr),
      hasCachedInsight: cachedDays.has(dateStr),
    });
  }

  return NextResponse.json({ weekDays });
}

// POST /api/insights { date: "YYYY-MM-DD" } — force regenerate for a specific day
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  let date: string;
  try {
    const body = await req.json();
    date = body.date;
  } catch {
    date = toDateStr(new Date());
  }

  return generateAndCache(authResult.userId, date);
}

async function generateAndCache(userId: string, date: string) {
  try {
    const config = await prisma.azureConfig.findUnique({
      where: { userId },
    });

    if (!config?.aiApiKey) {
      return NextResponse.json({
        todaysFocus:
          "Configure your AI provider in Settings to get insights.",
        recentAchievements: [],
        suggestedStandup:
          "Please configure your AI API key in Settings to generate standup suggestions.",
      });
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        commits: {
          where: { date: { gte: dayStart, lte: dayEnd } },
          orderBy: { date: "desc" },
        },
      },
    });

    const dayCommits = projects.flatMap((p) =>
      p.commits.map((c) => ({
        date: c.date.toISOString().split("T")[0],
        message: c.message,
        repoName: c.repoName,
      }))
    );

    const aiConfig: AIProviderConfig = {
      provider: config.aiProvider as AIProviderConfig["provider"],
      apiKey: config.aiApiKey,
      model: config.aiModel || undefined,
    };

    const insights = await generateDailyInsights(aiConfig, dayCommits, date);

    await prisma.dailyInsight.upsert({
      where: { userId_date: { userId, date } },
      update: {
        todaysFocus: insights.todaysFocus,
        recentAchievements: JSON.stringify(insights.recentAchievements),
        suggestedStandup: insights.suggestedStandup,
      },
      create: {
        userId,
        date,
        todaysFocus: insights.todaysFocus,
        recentAchievements: JSON.stringify(insights.recentAchievements),
        suggestedStandup: insights.suggestedStandup,
      },
    });

    return NextResponse.json({
      ...insights,
      cachedAt: new Date(),
    });
  } catch (error: unknown) {
    console.error("Insights error:", error);

    const errorMsg = error instanceof Error ? error.message : "";
    const isQuota =
      errorMsg.includes("quota") ||
      errorMsg.includes("rate") ||
      errorMsg.includes("429") ||
      errorMsg.includes("Insufficient Balance") ||
      errorMsg.includes("402");

    if (isQuota) {
      return NextResponse.json({
        todaysFocus:
          "AI quota exceeded. Try again later or switch provider in Settings.",
        recentAchievements: [],
        suggestedStandup:
          "AI rate limit reached. Wait a few minutes or switch to a different provider in Settings.",
      });
    }

    return NextResponse.json(
      { message: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
