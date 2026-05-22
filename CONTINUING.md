# Continuing AcedIt work from a new device

Quick checklist to pick up where the previous machine left off. The chat
session itself doesn't sync — but the codebase, deploy pipeline, and
context briefing (`CLAUDE.md`) do.

## One-time setup

1. **Install Claude Code**
   - https://claude.com/claude-code → follow install steps for your OS
   - Sign in with the same Anthropic account so usage bills against the
     same credit pool

2. **Clone the repo**
   ```bash
   git clone https://github.com/mil3s293044-del/AcedIt1.git acedit
   cd acedit
   ```

3. **Copy `.env.local` from the old machine**
   This file is gitignored (contains real API keys) so it never lives in
   the repo. AirDrop / iCloud Drive / 1Password Secure Notes — any path
   works. Required keys:
   - `ANTHROPIC_API_KEY`
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PRICE_PREMIUM`
   - `VITE_BASE44_APP_ID`, `VITE_BASE44_APP_BASE_URL` (legacy, kept for dual-run)
   - `VITE_USE_SUPABASE=true`
   - `RESEND_API_KEY` (optional locally — production has it on Render)

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Verify the local dev server boots**
   ```bash
   npm run dev
   ```
   - Vite on `http://localhost:5173`
   - Express API on `http://localhost:3001`

## Starting a Claude Code session on the new device

Run `claude` (or open the IDE plugin) from inside the `acedit/` directory.
It auto-loads `acedit/CLAUDE.md` which contains the full project briefing:
migration phases done, file layout, voice/style guardrails, gotchas.

Tell the assistant something like:
> "Read CLAUDE.md and the recent git log. Continuing work from where it
> left off — about to start UI/UX cleanup."

That gives the new session enough context to pick up.

## Making changes (any device)

The flow is identical across machines:

1. `git pull` before editing — avoids merge conflicts if you also worked
   on the other device
2. Make changes, test locally with `npm run dev`
3. Commit + push — Render auto-deploys on push to `main`
4. Verify on https://acedit.au once Render goes green
   (dashboard.render.com → acedit → Events)

## Multi-device collaboration rules

- **Push often** — every logical chunk of work
- **Pull before starting** — even a 2-minute pull-before-edit habit prevents
  conflicts
- **Don't run both `npm run dev` instances against the same Stripe webhook
  secret simultaneously** — they'd both try to handle the same events
- **`.env.local` is the truth on each device** — if you rotate a key,
  update it on every device that runs the dev server

## When something doesn't work

- Site loads but auth bounces to localhost → Supabase redirect URLs need
  the new device's localhost in the allowlist (Authentication → URL
  Configuration → Redirect URLs)
- Stripe webhook fails locally → you need `stripe listen --forward-to
  localhost:3001/local-ai/fn/stripe-webhook` running in another terminal
  (Stripe CLI required)
- AI calls fail with 401 → JWT expired; re-login or clear browser storage
- Render deploy fails → check Events page, usually a missing env var or
  a build error in the logs

## What lives where (canonical, in case the briefing files get stale)

- **Live site**: https://acedit.au (Render-hosted)
- **GitHub**: https://github.com/mil3s293044-del/AcedIt1
- **Supabase**: qhwyjycihgtxpzkitmpt.supabase.co
- **Render**: dashboard.render.com → `acedit` service
- **Stripe**: dashboard.stripe.com (live mode is the production one)
- **Resend**: resend.com (sender domain `acedit.au`)
- **Admin support inbox**: admin@acedit.com.au
