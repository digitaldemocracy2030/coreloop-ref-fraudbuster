# Project Coreloop Reference Product

inspired by Fraud Buster

## Local Setup

```bash
pnpm install
pnpm dev
```

## Environment

- `pull_request` to `main`: run CI (`pnpm lint`, `pnpm build`) and deploy Preview to Vercel
- `push` to `main`: run CI and deploy Production to Vercel

Set runtime environment variables in the Vercel Project settings.

- `DATABASE_URL`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`
- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_REPORT_SCREENSHOT_BUCKET` (optional, default: `report-screenshots`)
