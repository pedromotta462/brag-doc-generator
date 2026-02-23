import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { generateBragDoc, type AIProviderConfig, type BragDocMode } from "@/lib/ai-service";
import { z } from "zod";

// GET /api/brag-docs - List all brag docs for the user
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const docs = await prisma.bragDoc.findMany({
    where: { userId: authResult.userId },
    orderBy: { periodEnd: "desc" },
  });

  return NextResponse.json(docs);
}

// POST /api/brag-docs - Generate a new brag doc
const generateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  periodStart: z.string().min(1, "Start date is required"),
  periodEnd: z.string().min(1, "End date is required"),
  mode: z.enum(["detailed", "summary"]).default("detailed"),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json();
    const input = generateSchema.parse(body);

    const userId = authResult.userId;

    // Get AI config
    const config = await prisma.azureConfig.findUnique({
      where: { userId },
    });

    if (!config?.aiApiKey) {
      return NextResponse.json(
        { message: "AI provider API key not configured. Please set it in Settings." },
        { status: 400 }
      );
    }

    // Fetch commits for the period
    const startDate = new Date(input.periodStart);
    const endDate = new Date(input.periodEnd);
    endDate.setHours(23, 59, 59, 999); // Include full end day

    const projects = await prisma.project.findMany({
      where: { userId },
      include: {
        commits: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
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

    // Generate with AI
    const aiConfig: AIProviderConfig = {
      provider: config.aiProvider as AIProviderConfig["provider"],
      apiKey: config.aiApiKey,
      model: config.aiModel || undefined,
    };

    const content = await generateBragDoc(
      aiConfig,
      allCommits,
      input.periodStart,
      input.periodEnd,
      input.mode as BragDocMode
    );

    // Save
    const doc = await prisma.bragDoc.create({
      data: {
        userId,
        title: input.title,
        content,
        periodStart: startDate,
        periodEnd: endDate,
      },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Generate brag doc error:", err);
    return NextResponse.json(
      { message: "Failed to generate brag doc" },
      { status: 500 }
    );
  }
}
