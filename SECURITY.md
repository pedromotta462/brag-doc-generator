# Security Checklist for Deployment

## Pre-deploy verification

### 1. Environment variables (never commit to git)

- [ ] `NEXTAUTH_SECRET` — strong random value (`openssl rand -base64 32`)
- [ ] `CRON_SECRET` — strong random value (for scheduled sync)
- [ ] `ENCRYPTION_KEY` — optional, for encrypting PAT/API keys (or uses NEXTAUTH_SECRET)
- [ ] `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (if using Google login)
- [ ] `DATABASE_URL` — PostgreSQL connection string (Neon, Supabase, Vercel Postgres, etc.)

### 2. OAuth callback URLs

Update your GitHub/Google OAuth apps with production URLs:

- Homepage: `https://your-domain.com`
- Callback: `https://your-domain.com/api/auth/callback/github` (and `/google`)

### 3. NextAuth

- [ ] `NEXTAUTH_URL` set to your production URL (e.g. `https://your-domain.com`)
- [ ] `trustHost: true` is set (required for Vercel/proxies)

### 4. Security measures implemented

- **Authentication**: All API routes (except `/api/auth/*` and `/api/cron/sync`) require a valid session
- **Authorization**: Users can only access their own data (userId scoped queries)
- **Encryption**: PAT and AI API keys encrypted at rest (AES-256-GCM)
- **Cron protection**: `/api/cron/sync` uses timing-safe secret comparison
- **Input validation**: Limits on string lengths to prevent DoS
- **Security headers**: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

### 5. Optional hardening

- **Rate limiting**: Consider adding rate limiting (e.g. `@upstash/ratelimit`) for API routes
- **CSP**: Add Content-Security-Policy header if you need stricter XSS protection
- **Database**: PostgreSQL is required (SQLite is not supported)
