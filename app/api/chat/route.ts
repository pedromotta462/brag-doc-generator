import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { getDecryptedConfig } from "@/lib/config-helpers";
import { log } from "@/lib/logger";
import {
  generateChatResponse,
  type AIProviderConfig,
  type CommitContext,
} from "@/lib/ai-service";
import {
  fetchCommitChanges,
  fetchRepositories,
} from "@/lib/azure-devops";

// GET /api/chat — list conversations
export async function GET() {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const conversations = await prisma.chatConversation.findMany({
    where: { userId: authResult.userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(conversations);
}

// POST /api/chat — send a message
export async function POST(req: NextRequest) {
  const authResult = await requireAuth();
  if (authResult.error) return authResult.error;

  const userId = authResult.userId;

  let body: { message?: string; conversationId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid request body" },
      { status: 400 }
    );
  }

  if (typeof body.message !== "string") {
    return NextResponse.json(
      { message: "Message must be a string" },
      { status: 400 }
    );
  }

  const message = body.message.trim();
  log.debug("Chat", "Message received", {
    userId,
    messageLength: message.length,
    hasConversationId: !!body.conversationId,
  });

  if (!message) {
    return NextResponse.json(
      { message: "Message is required" },
      { status: 400 }
    );
  }
  if (message.length > 8000) {
    return NextResponse.json(
      { message: "Message too long (max 8000 characters)" },
      { status: 400 }
    );
  }

  const config = await getDecryptedConfig(userId);
  if (!config?.aiApiKey) {
    return NextResponse.json(
      { message: "Please configure your AI provider and API key in Settings." },
      { status: 400 }
    );
  }

  const aiConfig: AIProviderConfig = {
    provider: config.aiProvider as AIProviderConfig["provider"],
    apiKey: config.aiApiKey,
    model: config.aiModel || undefined,
  };

  // Get or create conversation
  let conversationId = body.conversationId;
  if (!conversationId) {
    const title =
      message.length > 60
        ? message.slice(0, 57) + "..."
        : message;
    const conversation = await prisma.chatConversation.create({
      data: { userId, title },
    });
    conversationId = conversation.id;
  } else {
    const existing = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Conversation not found" },
        { status: 404 }
      );
    }
  }

  // Save user message
  await prisma.chatMessage.create({
    data: { conversationId, role: "user", content: message },
  });

  // Load conversation history
  const previousMessages = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  // Parse the user question for context cues
  const commits = await gatherCommitContext(
    userId,
    message,
    config.organization,
    config.pat
  );

  try {
    const history = previousMessages.slice(0, -1).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const aiResponse = await generateChatResponse(
      aiConfig,
      message,
      commits,
      history
    );

    // Save assistant message
    await prisma.chatMessage.create({
      data: { conversationId, role: "assistant", content: aiResponse },
    });

    // Touch conversation updatedAt
    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    log.info("Chat", "Response generated", {
      userId,
      conversationId,
      responseLength: aiResponse.length,
    });

    return NextResponse.json({
      conversationId,
      response: aiResponse,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    log.error("Chat", "AI response failed", { userId, conversationId, error: errorMsg });

    const isQuota =
      errorMsg.includes("quota") ||
      errorMsg.includes("rate") ||
      errorMsg.includes("429") ||
      errorMsg.includes("Insufficient Balance") ||
      errorMsg.includes("402");

    if (isQuota) {
      return NextResponse.json(
        { message: "AI quota exceeded. Try again later or switch provider in Settings." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { message: "Failed to generate AI response. " + errorMsg },
      { status: 500 }
    );
  }
}

// ============================================
// Context Gathering
// ============================================

const COMMIT_HASH_REGEX = /\b([0-9a-f]{7,40})\b/gi;
const DATE_REGEX = /(\d{4}-\d{2}-\d{2})/g;
const RELATIVE_PERIOD_PATTERNS: { pattern: RegExp; daysBack: number }[] = [
  { pattern: /last\s+(week|semana)/i, daysBack: 7 },
  { pattern: /(last|ultimo|último)\s+(month|mês|mes)/i, daysBack: 30 },
  { pattern: /(today|hoje)/i, daysBack: 0 },
  { pattern: /(yesterday|ontem)/i, daysBack: 1 },
  { pattern: /last\s+(\d+)\s+days?/i, daysBack: -1 },
  { pattern: /últimos?\s+(\d+)\s+dias?/i, daysBack: -1 },
];

function parseDateRange(message: string): { from?: Date; to?: Date } {
  const dates = message.match(DATE_REGEX);
  if (dates && dates.length >= 2) {
    const sorted = dates.map((d) => new Date(d)).sort((a, b) => a.getTime() - b.getTime());
    return { from: sorted[0], to: sorted[sorted.length - 1] };
  }
  if (dates && dates.length === 1) {
    const d = new Date(dates[0]);
    const dayEnd = new Date(d);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return { from: d, to: dayEnd };
  }

  for (const { pattern, daysBack } of RELATIVE_PERIOD_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      const now = new Date();
      let actualDays = daysBack;
      if (daysBack === -1 && match[1]) {
        actualDays = parseInt(match[1]) || 30;
      } else if (daysBack === -1) {
        actualDays = parseInt(match[2]) || 30;
      }

      if (actualDays === 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return { from: today, to: now };
      }

      const from = new Date();
      from.setDate(from.getDate() - actualDays);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }
  }

  return {};
}

function extractCommitHashes(message: string): string[] {
  const matches = message.match(COMMIT_HASH_REGEX) || [];
  return matches.filter((h) => !/^\d+$/.test(h));
}

async function gatherCommitContext(
  userId: string,
  message: string,
  organization: string,
  pat: string
): Promise<CommitContext[]> {
  const hashes = extractCommitHashes(message);
  const { from, to } = parseDateRange(message);

  // If specific hashes are mentioned, fetch those commits with file changes
  if (hashes.length > 0) {
    const commits = await prisma.commit.findMany({
      where: {
        project: { userId },
        OR: hashes.map((h) => ({ hash: { startsWith: h } })),
      },
      include: { project: true },
      orderBy: { date: "desc" },
    });

    const results: CommitContext[] = [];
    for (const c of commits) {
      let fileChanges: { path: string; changeType: string }[] | undefined;
      try {
        const repos = await fetchRepositories(organization, c.project.name, pat);
        const repo = repos.find((r) => r.name === c.repoName);
        if (repo) {
          fileChanges = await fetchCommitChanges(
            organization,
            c.project.name,
            repo.id,
            c.hash,
            pat
          );
        }
      } catch {
        // Non-critical: file changes are optional enrichment
      }

      results.push({
        hash: c.hash,
        date: c.date.toISOString().split("T")[0],
        message: c.message,
        repoName: c.repoName,
        projectName: c.project.name,
        fileChanges,
      });
    }
    return results;
  }

  // Date-based or default query
  const dateFilter: Record<string, Date> = {};
  if (from) dateFilter.gte = from;
  if (to) dateFilter.lte = to;

  const hasDateFilter = Object.keys(dateFilter).length > 0;
  if (!hasDateFilter) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    dateFilter.gte = thirtyDaysAgo;
  }

  const projects = await prisma.project.findMany({
    where: { userId },
    include: {
      commits: {
        where: { date: dateFilter },
        orderBy: { date: "desc" },
        take: 200,
      },
    },
  });

  return projects.flatMap((p) =>
    p.commits.map((c) => ({
      hash: c.hash,
      date: c.date.toISOString().split("T")[0],
      message: c.message,
      repoName: c.repoName,
      projectName: p.name,
    }))
  );
}
