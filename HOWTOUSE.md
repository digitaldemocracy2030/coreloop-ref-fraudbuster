# HOW TO USE（初見ユーザー向け）

このドキュメントは、`AntiFraud` を初めて使う人向けに「起動方法」と「基本操作」をまとめたガイドです。

## 1. まずは動かす（ローカル起動）

### 前提

- Node.js（LTS）
- `pnpm`
- Supabase CLI（ローカルDB/Storageを使う場合）

### 手順

1. 依存関係をインストール

```bash
pnpm install
```

2. Supabaseローカル環境を起動

```bash
supabase start
```

3. 初回のみ、マイグレーションとシードを反映（データを初期化したい時にも使えます）

```bash
supabase db reset
```

4. `.env` を用意して必要な環境変数を設定

- 必須（最低限）
  - `DATABASE_URL`
- 通報機能を有効化する場合に必要
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - `TURNSTILE_SECRET_KEY`
- スクリーンショット添付を有効化する場合に必要
  - `SUPABASE_URL`（または `NEXT_PUBLIC_SUPABASE_URL`）
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_REPORT_SCREENSHOT_BUCKET`（省略時は `report-screenshots`）

例（ローカル開発）:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<supabase status で確認した service_role key>
SUPABASE_REPORT_SCREENSHOT_BUCKET=report-screenshots
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<Cloudflare Turnstile Site Key>
TURNSTILE_SECRET_KEY=<Cloudflare Turnstile Secret Key>
```

5. アプリを起動

```bash
pnpm dev
```

6. ブラウザで開く

- `http://localhost:3000`

## 2. 基本操作（画面ごと）

### ホーム（`/`）

- 最新通報がカードで表示されます。
- 上部の検索欄で `URL / タイトル / 説明` を横断検索できます。
- `話題` / `最新` タブで並び替えできます。
- 一覧は下へスクロールすると自動で続きを読み込みます。

### 通報する（`/report/new`）

4ステップで入力します。

1. 基本情報
   - 必須: 通報対象のURL、プラットフォーム、カテゴリー
2. 詳細と証拠
   - 任意: タイトル、詳細説明、スクリーンショット
   - 添付制限: JPG/PNGのみ、最大5枚、各5MBまで
3. 送信前チェック
   - 必須: メールアドレス、Cloudflare Turnstileの確認
4. 完了
   - 送信完了メッセージを表示。続けて通報も可能

### 通報詳細（`/reports/[id]`）

- URL、説明、関連画像、ステータス、リスク表示を確認できます。
- 右側のタイムラインで調査進捗を確認できます。
- 「この通報を修正・削除依頼」からお問い合わせ画面へ遷移できます。

### 統計（`/statistics`）

- 累計通報件数、当日件数、要注意プラットフォームを確認できます。
- 直近7日トレンド、カテゴリー内訳、プラットフォーム内訳を可視化します。

### お知らせ（`/announcements`）

- 注意喚起や更新情報の一覧/詳細を確認できます。

## 3. 初見でつまずきやすい点

- `環境変数 NEXT_PUBLIC_TURNSTILE_SITE_KEY が未設定です` と表示される
  - Turnstile未設定のため、通報送信ができません。
- `Storageの設定が不足しています` と表示される
  - 画像添付アップロードに必要な Supabase 設定が不足しています。
- `送信回数が多すぎます`（429）
  - 短時間の連続投稿は制限されています。時間を空けて再試行してください。
- データが表示されない
  - `supabase db reset` を実行してシードデータを入れてください。

## 4. 補足

- 利用規約: `/terms`
- プライバシーポリシー: `/privacy`
- お問い合わせ: `/contact`
