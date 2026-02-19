import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { z } from "zod";

// GET /api/azure/config - Get user's Azure config
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const config = await prisma.azureConfig.findUnique({
    where: { userId: authResult.userId },
  });

  return NextResponse.json(config);
}

// POST /api/azure/config - Create or update Azure config
const updateConfigSchema = z.object({
  organization: z.string().min(1, "Organization is required"),
  pat: z.string().min(1, "PAT is required"),
  userAliases: z.array(z.string()).min(1, "At least one username alias is required"),
  aiProvider: z.enum(["openai", "claude", "gemini", "deepseek"]).default("deepseek"),
  aiModel: z.string().optional(),
  aiApiKey: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json();
    const input = updateConfigSchema.parse(body);

    const config = await prisma.azureConfig.upsert({
      where: { userId: authResult.userId },
      update: {
        organization: input.organization,
        pat: input.pat,
        userAliases: JSON.stringify(input.userAliases),
        aiProvider: input.aiProvider,
        aiModel: input.aiModel || undefined,
        aiApiKey: input.aiApiKey || undefined,
      },
      create: {
        userId: authResult.userId,
        organization: input.organization,
        pat: input.pat,
        userAliases: JSON.stringify(input.userAliases),
        aiProvider: input.aiProvider,
        aiModel: input.aiModel || undefined,
        aiApiKey: input.aiApiKey || undefined,
      },
    });

    return NextResponse.json(config);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Config update error:", err);
    return NextResponse.json(
      { message: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
