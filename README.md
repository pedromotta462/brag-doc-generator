# Brag Doc Generator

A Next.js application that connects to Azure DevOps, syncs your commits across all projects, and uses AI to generate brag documents, daily standup insights, repository summaries, and an interactive chat about your work history.

## Features

### Dashboard
- Overview of synced projects, repositories, and total commits
- Interactive charts: commit activity (last 30 days), commit distribution by day of week, commits by project (pie chart), top repositories by commits
- Daily standup assistant preview powered by AI

### Repositories Tab
- Lists all repositories you've worked on with commit counts and last commit date
- AI-generated work summaries describing what was actually done in code (not just commit counts)
- Recent commit messages per repository

### Daily Insights
- Weekday selector (Mon–Fri) showing which days had commits
- Per-day AI-generated insights: suggested standup text, achievements, and focus suggestions
- Insights are cached per day — AI is called only once, subsequent visits show cached data
- Manual regenerate button per day

### Brag Documents
- Generate AI-powered brag documents for any date range
- Two modes: **Detailed & Comprehensive** (for performance reviews) or **Quick Summary** (readable in 2 minutes)
- Professional document viewer with white paper-like styling
- Export as PDF (via browser print) or download as Markdown
- Copy to clipboard

### Ask AI (Chat)
- Conversational AI that answers questions about your commits
- Supports queries like "what did I do last week?", "what changed in commit abc123?", "summarize my work from Jan 1 to Jan 31"
- Extracts date ranges and commit hashes from natural language
- Fetches file-level changes for specific commits from Azure DevOps
- Persistent conversation history with sidebar

### Settings
- Azure DevOps connection: organization, PAT, and user aliases (supports multiple usernames)
- AI provider selection: DeepSeek, Google Gemini, OpenAI, or Claude
- Model picker and API key configuration per provider

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Auth | NextAuth.js v5 (GitHub + Google OAuth) |
| Database | PostgreSQL via Prisma ORM 5 |
| AI | Vercel AI SDK with OpenAI, Anthropic, Google Gemini, DeepSeek |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Charts | Recharts |
| Markdown | react-markdown |

## Project Structure

```
brag-doc-generator/
├── app/
│   ├── (dashboard)/          # Protected routes (require auth)
│   │   ├── page.tsx          # Dashboard with stats & charts
│   │   ├── daily/page.tsx    # Daily insights with weekday selector
│   │   ├── brag-docs/page.tsx# Brag document management
│   │   ├── chat/page.tsx     # AI chat about commits
│   │   ├── settings/page.tsx # Azure DevOps & AI configuration
│   │   └── layout.tsx        # Auth guard + sidebar layout
│   ├── login/page.tsx        # GitHub & Google sign-in page
│   ├── api/
│   │   ├── auth/[...nextauth]/ # NextAuth handler
│   │   ├── azure/
│   │   │   ├── config/       # GET/POST Azure DevOps config
│   │   │   └── sync/         # POST sync commits from Azure
│   │   ├── cron/
│   │   │   └── sync/         # GET scheduled sync (CRON_SECRET protected)
│   │   ├── projects/         # GET synced projects
│   │   ├── stats/
│   │   │   ├── route.ts      # GET aggregated metrics
│   │   │   └── summaries/    # GET/POST AI repo summaries
│   │   ├── insights/         # GET/POST daily insights (per weekday)
│   │   ├── brag-docs/
│   │   │   ├── route.ts      # GET list / POST generate
│   │   │   └── [id]/         # GET/DELETE individual doc
│   │   └── chat/
│   │       ├── route.ts      # GET conversations / POST message
│   │       └── [id]/         # GET/DELETE conversation
│   ├── layout.tsx            # Root layout with providers
│   └── globals.css           # Tailwind + theme variables
├── components/
│   ├── sidebar-nav.tsx       # Navigation sidebar
│   ├── providers.tsx         # Session, theme, error providers
│   ├── error-modal.tsx       # Global error modal
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── prisma.ts             # Prisma client singleton
│   ├── auth.ts               # NextAuth config (GitHub + Google + Prisma adapter)
│   ├── auth-helpers.ts       # Auth utilities for API routes
│   ├── ai-service.ts         # Multi-provider AI service
│   ├── azure-devops.ts       # Azure DevOps REST API client
│   ├── api-client.ts         # Typed fetch wrapper with error handling
│   ├── encryption.ts         # AES-256-GCM encrypt/decrypt for secrets
│   ├── config-helpers.ts     # Decrypted config helper
│   ├── sync-service.ts       # Shared sync logic (manual + cron)
│   ├── logger.ts             # Structured backend logger
│   └── utils.ts              # Class name utilities
├── prisma/
│   └── schema.prisma         # Database schema
└── types/
    └── next-auth.d.ts        # NextAuth type extensions
```

## Database Models

| Model | Purpose |
|-------|---------|
| `User` | Authenticated user (via NextAuth) |
| `Account` / `Session` | NextAuth OAuth and session management |
| `AzureConfig` | Azure DevOps org, PAT, user aliases, AI provider settings |
| `Project` | Synced Azure DevOps project |
| `Commit` | Individual commit with hash, message, author, date, repo name |
| `BragDoc` | Generated brag document with title, content, period |
| `DailyInsight` | Cached AI insights per user per day (YYYY-MM-DD) |
| `RepoSummary` | Cached AI-generated repository work summary |
| `ChatConversation` | Chat conversation with title and timestamps |
| `ChatMessage` | Individual chat message (user or assistant) |

## AI Providers

| Provider | Models | Free Tier |
|----------|--------|-----------|
| DeepSeek | DeepSeek-V3 (Chat), DeepSeek-R1 (Reasoner) | Yes (balance-based) |
| Google Gemini | Gemini 3.1 Pro, 3 Flash, 2.5 Pro, 2.5 Flash, 2.0 Flash, 1.5 Flash | Yes (2.5 Flash) |
| OpenAI | GPT-4o Mini, GPT-4o, GPT-4.1 Mini, GPT-4.1 | No |
| Claude (Anthropic) | Claude Sonnet 4, Claude Haiku 4 | No |

## Getting Started

### Prerequisites

- Node.js 20+
- A GitHub account (for authentication)
- An Azure DevOps account with a Personal Access Token (PAT)
- An API key from at least one AI provider

### 1. Install dependencies

```bash
cd brag-doc-generator
npm install
```

### 2. Configure environment variables

Create a `.env` file:

```env
# PostgreSQL - create a database at Neon, Supabase, Vercel Postgres, or Railway
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-random-secret-here"
ENCRYPTION_KEY="optional-32-char-secret-for-encryption"
GITHUB_CLIENT_ID="your-github-oauth-client-id"
GITHUB_CLIENT_SECRET="your-github-oauth-client-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
CRON_SECRET="your-cron-secret-for-scheduled-sync"
```

- **ENCRYPTION_KEY** (optional): Used to encrypt PAT and AI API keys in the database. If omitted, `NEXTAUTH_SECRET` is used. For production, prefer a dedicated 32+ character secret.
- **GOOGLE_CLIENT_ID** / **GOOGLE_CLIENT_SECRET** (optional): Enable Google sign-in. If omitted, only GitHub login is available.
- **CRON_SECRET** (optional): Secret for the scheduled Azure sync cron. Required on Vercel for automatic daily sync at 1 AM (Brazil time). Generate with `openssl rand -hex 32`.
- **DEBUG_LOGS** (optional): Set to `"true"` for verbose backend logs (auth failures, cache hits, etc.). Never logs secrets or tokens.

#### GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Create a new OAuth App
3. Set **Homepage URL** to `http://localhost:3000`
4. Set **Authorization callback URL** to `http://localhost:3000/api/auth/callback/github`
5. Copy the Client ID and Client Secret to `.env`

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project or select an existing one
3. Go to **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
4. Choose **Web application**, add **Authorized redirect URI**: `http://localhost:3000/api/auth/callback/google`
5. Copy the Client ID and Client Secret to `.env`

### 3. Initialize the database

Create a PostgreSQL database (free tiers: [Neon](https://neon.tech), [Supabase](https://supabase.com), [Vercel Postgres](https://vercel.com/storage/postgres)), then:

```bash
npx prisma migrate deploy
npx prisma generate
```

For local development with a fresh DB, use `npx prisma migrate dev` instead of `migrate deploy`.

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with GitHub or Google.

### 5. Configure the app

1. Go to **Settings**
2. Enter your Azure DevOps **Organization** name and **Personal Access Token**
3. Add your **user aliases** (the names/emails that appear in your commits)
4. Select an **AI provider** and enter the API key
5. Click **Save**, then go to **Dashboard** and click **Sync Now**

#### Scheduled Sync (Cron)

A cron job runs **daily at 1 AM (Brazil time)** to sync Azure DevOps data for all users. On **Vercel**, add `CRON_SECRET` to your environment variables — Vercel will automatically invoke `/api/cron/sync` with the correct auth header.

For **self-hosted** deployments, use an external cron (e.g. [cron-job.org](https://cron-job.org), GitHub Actions, or system cron) to call:

```
GET https://your-domain.com/api/cron/sync
Authorization: Bearer <CRON_SECRET>
```

Or use the header: `x-cron-secret: <CRON_SECRET>`.

## How It Works

1. **Sync**: The app fetches all projects and repositories from your Azure DevOps organization, then pulls commits filtered by your user aliases. Manual sync via Dashboard or scheduled daily at 1 AM
2. **Dashboard**: Aggregated metrics and charts are computed server-side from the synced commit data
3. **AI Features**: When you generate a brag doc, request daily insights, or ask a question in the chat, the app sends your commit data to the configured AI provider with carefully crafted prompts
4. **Caching**: Daily insights and repository summaries are cached in the database to avoid redundant AI calls — they're generated once and reused on subsequent page loads
5. **PDF Export**: Uses the browser's native print-to-PDF with a styled HTML template that matches the in-app document view
6. **Encryption**: PAT and AI API keys are encrypted with AES-256-GCM before being stored in the database. The encryption key is derived from `ENCRYPTION_KEY` or `NEXTAUTH_SECRET`
