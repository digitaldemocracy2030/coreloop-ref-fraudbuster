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
