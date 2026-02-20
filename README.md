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

### Admin Login

管理画面（`/admin`）を利用するには以下の環境変数を設定してください。

```bash
ADMIN_LOGIN_EMAIL=admin@example.com
ADMIN_LOGIN_PASSWORD=your-strong-password
ADMIN_SESSION_SECRET=long-random-secret
```
