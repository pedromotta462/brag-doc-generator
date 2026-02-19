// ============================================
// AI Service - Multi Provider via Vercel AI SDK
// ============================================

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

// ============================================
// Provider Configuration
// ============================================

export type AIProvider = "openai" | "claude" | "gemini" | "deepseek";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model?: string;
}

export const PROVIDER_INFO: Record<
  AIProvider,
  {
    label: string;
    defaultModel: string;
    models: { value: string; label: string }[];
    free: boolean;
    tokenUrl: string;
  }
> = {
  deepseek: {
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    models: [
      { value: "deepseek-chat", label: "DeepSeek-V3 (Chat)" },
      { value: "deepseek-reasoner", label: "DeepSeek-R1 (Reasoner)" },
    ],
    free: true,
    tokenUrl: "https://platform.deepseek.com/api_keys",
  },
  gemini: {
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    models: [
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Free)" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Free)" },
      { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
    free: true,
    tokenUrl: "https://aistudio.google.com/app/apikey",
  },
  openai: {
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    models: [
      { value: "gpt-4o-mini", label: "GPT-4o Mini" },
      { value: "gpt-4o", label: "GPT-4o" },
      { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
      { value: "gpt-4.1", label: "GPT-4.1" },
    ],
    free: false,
    tokenUrl: "https://platform.openai.com/api-keys",
  },
  claude: {
    label: "Claude (Anthropic)",
    defaultModel: "claude-sonnet-4-20250514",
    models: [
      { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
      { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
    ],
    free: false,
    tokenUrl: "https://console.anthropic.com/settings/keys",
  },
};

// ============================================
// Create AI Model Instance
// ============================================

function getModel(config: AIProviderConfig) {
  const modelId = config.model || PROVIDER_INFO[config.provider].defaultModel;

  switch (config.provider) {
    case "deepseek": {
      // DeepSeek uses OpenAI-compatible API
      const deepseek = createOpenAI({
        apiKey: config.apiKey,
        baseURL: "https://api.deepseek.com",
      });
      return deepseek(modelId);
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: config.apiKey,
      });
      return openai(modelId);
    }
    case "claude": {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
      });
      return anthropic(modelId);
    }
    case "gemini": {
      const google = createGoogleGenerativeAI({
        apiKey: config.apiKey,
      });
      return google(modelId);
    }
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

// ============================================
// Brag Doc Generation
// ============================================

export async function generateBragDoc(
  config: AIProviderConfig,
  commits: { date: string; message: string; repoName?: string | null }[],
  periodStart: string,
  periodEnd: string
): Promise<string> {
  if (commits.length === 0) {
    return "# Brag Document\n\nNo commits found for this period.";
  }

  const commitsText = commits
    .map(
      (c) =>
        `- [${c.date}]${c.repoName ? ` (${c.repoName})` : ""} ${c.message}`
    )
    .join("\n");

  const { text } = await generateText({
    model: getModel(config),
    prompt: `You are an expert engineering manager helper.
I need you to write a "Brag Document" (Self-Review) for me based on my git commit history.

Period: ${periodStart} to ${periodEnd}
Total commits: ${commits.length}

My Commits:
${commitsText}

Instructions:
- Group these into meaningful categories (e.g., Features, Bug Fixes, Refactoring, Infrastructure, Documentation)
- Highlight the impact of each group (infer from commit messages)
- Include specific numbers where possible (e.g., "Implemented 5 new API endpoints")
- Write it in Markdown format
- Keep it professional but highlighting achievements
- Start with a brief executive summary
- End with key metrics (total commits, repos touched, etc.)`,
  });

  return text;
}

// ============================================
// Daily Standup Insights
// ============================================

export interface DailyInsights {
  todaysFocus: string;
  recentAchievements: string[];
  suggestedStandup: string;
}

export async function generateDailyInsights(
  config: AIProviderConfig,
  commits: { date: string; message: string; repoName?: string | null }[]
): Promise<DailyInsights> {
  if (commits.length === 0) {
    return {
      todaysFocus: "Start by picking a task from your backlog.",
      recentAchievements: [],
      suggestedStandup:
        "I'm planning my tasks and setting up for the day ahead.",
    };
  }

  const commitsText = commits
    .map(
      (c) =>
        `- [${c.date}]${c.repoName ? ` (${c.repoName})` : ""} ${c.message}`
    )
    .join("\n");

  const { text } = await generateText({
    model: getModel(config),
    prompt: `Based on my recent git commit history (last 3 days), provide daily standup insights.

Commits:
${commitsText}

Return ONLY a valid JSON object with this exact format, no markdown code blocks:
{
  "todaysFocus": "One sentence suggestion on what to focus on next based on recent work patterns",
  "recentAchievements": ["Achievement 1", "Achievement 2", "Achievement 3"],
  "suggestedStandup": "A concise paragraph I can say in my daily standup meeting summarizing what I did and what I plan to do"
}`,
  });

  try {
    // Try to parse JSON from the response, handling possible markdown code blocks
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as DailyInsights;
  } catch {
    return {
      todaysFocus: "Continue working on current tasks.",
      recentAchievements: ["Made progress on recent commits"],
      suggestedStandup: text.slice(0, 500),
    };
  }
}
