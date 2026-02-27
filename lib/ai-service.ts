// ============================================
// AI Service - Multi Provider via Vercel AI SDK
// ============================================

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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
    defaultModel: "gemini-2.5-flash",
    models: [
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (Free)" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
      { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
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
      const deepseek = createOpenAICompatible({
        name: "deepseek",
        apiKey: config.apiKey,
        baseURL: "https://api.deepseek.com/v1",
      });
      return deepseek.chatModel(modelId);
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

export type BragDocMode = "detailed" | "summary";

export async function generateBragDoc(
  config: AIProviderConfig,
  commits: { date: string; message: string; repoName?: string | null }[],
  periodStart: string,
  periodEnd: string,
  mode: BragDocMode = "detailed"
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

  const detailedInstructions = `Instructions:
- Write a comprehensive, well-structured "Brag Document" (Self-Review)
- Group commits into meaningful categories (e.g., Features, Bug Fixes, Refactoring, Infrastructure, Documentation)
- For each category, write detailed paragraphs explaining the work, its context, and its impact
- Highlight the impact of each group (infer from commit messages)
- Include specific numbers where possible (e.g., "Implemented 5 new API endpoints")
- Write it in Markdown format with proper headings (h1 for title, h2 for sections, h3 for subsections)
- Keep it professional but highlighting achievements
- Start with a brief executive summary (2-3 paragraphs)
- Include a "Key Highlights" section with the most impactful work
- End with key metrics (total commits, repos touched, categories of work, etc.)
- Be thorough — this document should be ready for a performance review`;

  const summaryInstructions = `Instructions:
- Write a concise, quick summary of my work during this period
- Use bullet points for brevity
- Group into 3-5 high-level categories maximum
- Keep each bullet point to 1-2 sentences
- Start with a 2-3 sentence executive summary
- End with quick stats (total commits, repos touched)
- The entire document should be readable in under 2 minutes
- Write it in Markdown format`;

  const { text } = await generateText({
    model: getModel(config),
    maxRetries: 1,
    prompt: `You are an expert engineering manager helper.
I need you to write a "Brag Document" (Self-Review) for me based on my git commit history.

Period: ${periodStart} to ${periodEnd}
Total commits: ${commits.length}
Format: ${mode === "detailed" ? "Detailed & Comprehensive" : "Quick Summary"}

My Commits:
${commitsText}

${mode === "detailed" ? detailedInstructions : summaryInstructions}`,
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
  commits: { date: string; message: string; repoName?: string | null }[],
  targetDate: string
): Promise<DailyInsights> {
  if (commits.length === 0) {
    return {
      todaysFocus: "No commits found for this day.",
      recentAchievements: [],
      suggestedStandup:
        "No activity recorded for this day.",
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
    maxRetries: 1,
    prompt: `Based on my git commit history for ${targetDate}, provide daily standup insights for that specific day.

Commits on ${targetDate}:
${commitsText}

Return ONLY a valid JSON object with this exact format, no markdown code blocks:
{
  "todaysFocus": "One sentence suggestion on what to focus on next based on this day's work",
  "recentAchievements": ["Achievement 1", "Achievement 2", "Achievement 3"],
  "suggestedStandup": "A concise paragraph I can say in my daily standup meeting summarizing what I did on this day"
}`,
  });

  try {
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

// ============================================
// Repository Work Summaries (AI-powered)
// ============================================

export interface RepoCommitsForSummary {
  repoName: string;
  projectName: string;
  messages: string[];
}

export async function generateRepoSummaries(
  config: AIProviderConfig,
  repos: RepoCommitsForSummary[]
): Promise<Record<string, string>> {
  if (repos.length === 0) return {};

  const reposBlock = repos
    .map((r) => {
      const msgs = r.messages.slice(0, 25).join("\n  - ");
      return `### ${r.repoName} (project: ${r.projectName}, ${r.messages.length} total commits)\n  - ${msgs}`;
    })
    .join("\n\n");

  const { text } = await generateText({
    model: getModel(config),
    maxRetries: 1,
    system: `You are a senior engineering analyst. Your job is to read git commit messages for each repository and write a concise, human-readable summary of the actual work done.
Focus on WHAT was built/changed/fixed — not just counts. Mention specific features, modules, or areas of the codebase when you can infer them from the messages.
Each summary should be 1-3 sentences and written in a professional but approachable tone.
Answer in the same language the commit messages are mostly written in (e.g., English or Portuguese).`,
    prompt: `For each repository below, write a brief summary of the work done based on the commit messages.

${reposBlock}

Return ONLY a valid JSON object where each key is the repository name and the value is the summary string. No markdown code blocks, no extra text.
Example: {"repo-a": "Implemented user authentication flow with JWT tokens and added password reset endpoints.", "repo-b": "Fixed data export bugs and improved CSV parsing for large files."}`,
  });

  try {
    const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned) as Record<string, string>;
  } catch {
    return {};
  }
}

// ============================================
// Chat About Commits
// ============================================

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CommitContext {
  hash: string;
  date: string;
  message: string;
  repoName?: string | null;
  projectName?: string;
  fileChanges?: { path: string; changeType: string }[];
}

export async function generateChatResponse(
  config: AIProviderConfig,
  question: string,
  commits: CommitContext[],
  history: ChatHistoryMessage[] = []
): Promise<string> {
  const commitsText =
    commits.length > 0
      ? commits
          .map((c) => {
            let line = `- [${c.date}] (${c.projectName || "unknown"}/${c.repoName || "unknown"}) ${c.hash.slice(0, 8)}: ${c.message}`;
            if (c.fileChanges && c.fileChanges.length > 0) {
              line +=
                "\n  Changed files:\n" +
                c.fileChanges
                  .map((f) => `    ${f.changeType.toUpperCase()} ${f.path}`)
                  .join("\n");
            }
            return line;
          })
          .join("\n")
      : "No commits found for the given criteria.";

  const conversationHistory = history
    .slice(-10)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const systemPrompt = `You are an intelligent assistant that helps a software developer understand their work based on their Azure DevOps commit history.

Your capabilities:
- Summarize what the user worked on during a given period
- Explain what a specific commit did based on its message and changed files
- Identify patterns and trends in the user's work
- Help prepare status updates or reports

Guidelines:
- Answer in the same language the user writes in
- Be concise but thorough
- When listing commits, use the short hash (first 8 chars)
- Format your responses in Markdown for readability
- If commit data is insufficient to answer a question, say so honestly
- Only reference commits that are provided in the context — do not invent data`;

  const userPrompt = `${conversationHistory ? `Previous conversation:\n${conversationHistory}\n\n---\n\n` : ""}Relevant commits (${commits.length} total):
${commitsText}

User question: ${question}`;

  const { text } = await generateText({
    model: getModel(config),
    maxRetries: 1,
    system: systemPrompt,
    prompt: userPrompt,
  });

  return text;
}
