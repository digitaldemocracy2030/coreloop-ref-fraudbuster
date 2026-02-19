# Project Coreloop Reference Product

inspired by Fraud Buster

## Local Setup

```bash
pnpm install
pnpm dev
```

## CI/CD (GitHub Actions -> Vercel)

Workflow: `.github/workflows/vercel-cicd.yml`

- `pull_request` to `main`: run CI (`pnpm lint`, `pnpm build`) and deploy Preview to Vercel
- `push` to `main`: run CI and deploy Production to Vercel

### Required GitHub Secrets

```bash
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

Set runtime environment variables (e.g. `DATABASE_URL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) in the Vercel Project settings.
