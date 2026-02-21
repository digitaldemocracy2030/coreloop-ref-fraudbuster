# Anti-Fraud Crowdsourcing Platform (参考プロダクト)

SNSやメッセージアプリ、不審なURLなどのネット詐欺情報を収集・共有・検索するためのプラットフォームです。

## 主な機能

### 1. 詐欺情報の検索・閲覧
- **インクリメンタル検索**: URLやキーワードで疑わしい案件を即座に検索可能。
- **カテゴリ別閲覧**: 投資詐欺、フィッシング、ロマンス詐欺などの手口別に一覧表示。
- **リスク判定**: 各案件に対して「詐欺確定」「高リスク」「調査中」などのバッジを表示。

### 2. 通報システム
- **フォーム投稿**: 不審なURL、詳細な説明、証拠画像のアップロードが可能。
- **不正投稿対策**: Cloudflare Turnstileによるボット排除と人間判定。

### 3. 案件詳細・タイムライン
- **証拠画像カルーセル**: 投稿されたスクリーンショットを確認。
- **処理状況の可視化**: 通報からプラットフォーム社への通知、調査完了までの進捗をタイムラインで表示。
- **関連案件**: 類似の詐欺手口へのクイックアクセス。

### 4. 統計ダッシュボード
- **トレンド可視化**: 期間ごとの通報件数やリスク分布をグラフで表示（Recharts）。
- **プラットフォーム分析**: LINE、Facebook、Instagramなど、どの媒体で詐欺が多いかを分析。

### 5. お知らせ・警告バナー
- **重要通知**: 最新の詐欺トレンドや緊急の注意喚起をトップページに表示。

## 技術スタック

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4
- **UI Components**: Radix UI, Lucide React, Embla Carousel, Recharts
- **Database/ORM**: PostgreSQL, Prisma
- **Form/Validation**: React Hook Form, Zod
- **Tooling**: Biome (Lint & Format), pnpm

## Local Setup

```bash
pnpm install
pnpm dev
```

## Environment

- `pull_request` to `main`: run CI (`pnpm lint`, `pnpm build`) and deploy Preview to Vercel
- `push` to `main`: run CI and deploy Production to Vercel
