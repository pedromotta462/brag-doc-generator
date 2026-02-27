import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { getDecryptedConfig } from "@/lib/config-helpers";
import { encrypt } from "@/lib/encryption";
import { log } from "@/lib/logger";
import { z } from "zod";

// GET /api/azure/config - Get user's Azure config (decrypted for display)
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const config = await getDecryptedConfig(authResult.userId);
  return NextResponse.json(config);
}

// POST /api/azure/config - Create or update Azure config
const updateConfigSchema = z.object({
  organization: z.string().min(1, "Organization is required").max(200),
  pat: z.string().min(1, "PAT is required").max(500),
  userAliases: z
    .array(z.string().min(1).max(200))
    .min(1, "At least one username alias is required")
    .max(20),
  aiProvider: z.enum(["openai", "claude", "gemini", "deepseek"]).default("deepseek"),
  aiModel: z.string().max(100).optional(),
  aiApiKey: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  try {
    const body = await req.json();
    const input = updateConfigSchema.parse(body);

    const encryptedPat = encrypt(input.pat);
    const encryptedApiKey = input.aiApiKey?.trim()
      ? encrypt(input.aiApiKey.trim())
      : undefined;

    const updateData = {
      organization: input.organization,
      pat: encryptedPat,
      userAliases: JSON.stringify(input.userAliases),
      aiProvider: input.aiProvider,
      aiModel: input.aiModel || undefined,
      ...(encryptedApiKey != null && { aiApiKey: encryptedApiKey }),
    };

    const config = await prisma.azureConfig.upsert({
      where: { userId: authResult.userId },
      update: updateData,
      create: {
        userId: authResult.userId,
        organization: input.organization,
        pat: encryptedPat,
        userAliases: JSON.stringify(input.userAliases),
        aiProvider: input.aiProvider,
        aiModel: input.aiModel || undefined,
        aiApiKey: encryptedApiKey ?? null,
      },
    });

    log.info("Config", "Config saved", {
      userId: authResult.userId,
      organization: input.organization,
      aiProvider: input.aiProvider,
      hasApiKey: !!input.aiApiKey?.trim(),
    });

    // Return decrypted values for consistency (client may refetch)
    const decrypted = await getDecryptedConfig(authResult.userId);
    return NextResponse.json(decrypted ?? config);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { message: err.issues[0].message },
        { status: 400 }
      );
    }
    log.error("Config", "Config update failed", {
      userId: authResult.userId,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return NextResponse.json(
      { message: "Failed to update configuration" },
      { status: 500 }
    );
  }
}
