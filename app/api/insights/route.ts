import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { generateDailyInsights, type AIProviderConfig } from "@/lib/ai-service";

// GET /api/insights - Get daily standup insights
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const userId = authResult.userId;

    // Get AI config
    const config = await prisma.azureConfig.findUnique({
      where: { userId },
    });

    if (!config?.aiApiKey) {
      return NextResponse.json({
        todaysFocus: "Configure your AI provider in Settings to get insights.",
        recentAchievements: [],
        suggestedStandup:
          "Please configure your AI API key in Settings to generate standup suggestions.",
      });
    }

    // Fetch last 3 days of commits
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        commits: {
          where: {
            date: { gte: threeDaysAgo },
          },
          orderBy: { date: "desc" },
        },
      },
    });

    const allCommits = projects.flatMap((p) =>
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

    const insights = await generateDailyInsights(aiConfig, allCommits);

    return NextResponse.json(insights);
  } catch (error) {
    console.error("Insights error:", error);
    return NextResponse.json(
      { message: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
