# ローカル開発セットアップタスク

## 概要

API (`packages/web`) をローカルで動作させるための3つのタスク。

## Working Directory

**すべてのコマンドは `packages/web` ディレクトリで実行する。**

```bash
cd packages/web
```

---

## 1. 環境変数のセットアップ

### 目的
`.env.example` を元に `.env` を作成し、準備済みの認証情報を設定する。

### 前提条件
- Turso DBが作成済み
- GitHub OAuth Appが作成済み
- Resend APIキーが取得済み

### 設定項目

| 変数 | 説明 | 取得元 |
|------|------|--------|
| `TURSO_DATABASE_URL` | `libsql://xxx.turso.io` 形式 | `turso db show ultrahope` |
| `TURSO_AUTH_TOKEN` | DBトークン | `turso db tokens create ultrahope` |
| `GITHUB_CLIENT_ID` | OAuth App ID | GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | OAuth App Secret | GitHub Developer Settings |
| `RESEND_API_KEY` | メール送信用 | Resend Dashboard |
| `EMAIL_FROM` | 送信元アドレス | 任意 (例: `noreply@ultrahope.dev`) |
| `DEVICE_VERIFICATION_URI` | 開発時は `http://localhost:3000/device` | - |
| `MINIMAX_API_KEY` | ⚠️ 後で設定 (translate機能用) | - |

### 補足
- `MINIMAX_API_KEY` は未設定でもサーバー起動は可能だが、`/v1/translate` は失敗する
- GitHub OAuth Appのcallback URLが `http://localhost:3000/api/callback/github` になっているか確認

---

## 2. DBスキーマ生成

### 目的
Better Authが必要とするテーブル (user, session, account, device_authorization等) をTurso DBに作成する。

### コマンド

```bash
pnpm dlx @better-auth/cli generate --config ./src/lib/auth.ts --output ./src/db/schema.ts
```

- `--config` — auth.tsの場所を指定 (デフォルトはプロジェクトルートを探す)
- `--output` — schema出力先を指定 (drizzle.config.tsの `schema` と一致させる)

### Better Auth CLIの仕組み
上記コマンドは:
1. `auth.ts` の設定 (plugins含む) を解析
2. 必要なテーブル定義をDrizzle schema形式で生成
3. `--output` で指定したパスに出力

### 実行後の流れ
```
@better-auth/cli generate  →  src/db/schema.ts 生成
                                    ↓
pnpm drizzle-kit push      →  Turso DBにテーブル作成
```

### 生成されるテーブル (予想)
- `user` - ユーザー情報
- `session` - ログインセッション
- `account` - OAuthアカウント紐付け (GitHub等)
- `verification` - メール検証/Magic Link用
- `device_authorization` - Device Flow用コード管理

### 再実行が必要なケース
基本的に初回のみ実行。以下の場合のみ再実行:
- Better Authのプラグインを追加/削除した時
- Better Authをバージョンアップした時 (schemaに変更がある場合)

### 注意点
- schemaファイル生成後、`db/client.ts` でimportが必要になる可能性あり
- drizzle-kit push前にschemaの内容を確認推奨

---

## 3. Device Verification Page (`/device`)

### 目的
Device FlowでCLIが表示するURLのランディングページ。ユーザーがuser_codeを入力し、GitHub/Magic Linkで認証する。

### フロー

```
CLI: ultrahope login
  ↓
POST /api/device/code
  → device_code, user_code, verification_uri
  ↓
CLI: "Open http://localhost:3000/device and enter: ABCD-1234"
  ↓
User: ブラウザで /device にアクセス
  ↓
/device ページ:
  1. user_code入力フォーム
  2. Submit → POST /api/device/verify (user_codeを検証)
  3. 認証方法選択 (GitHub Login or Magic Link)
  4. 認証成功 → device_codeを承認済みに
  ↓
CLI: polling POST /api/device/token
  → access_token取得、~/.ultrahope/credentials に保存
```

### ページの実装方針

#### Option A: API側でHTML返却 (シンプル)
ElysiaJSで直接HTMLを返す。外部依存なし。

```typescript
app.get('/device', () => {
  return new Response(/* HTML */, {
    headers: { 'Content-Type': 'text/html' }
  })
})
```

#### Option B: 別パッケージでWeb UI
`packages/web` を作成し、SvelteKit/Next.js等で実装。将来のダッシュボード等と統合。

### 現時点の推奨
**Option A** でMVPを作成。HTMLテンプレートは最小限 (Tailwind CDN可)。将来的にOption Bに移行可能。

### 必要なエンドポイント (Better Auth Device Flow)
Better Authのdevice-authorizationプラグインが提供:
- `POST /api/device/code` - デバイスコード発行
- `POST /api/device/verify` - user_code検証
- `POST /api/device/token` - アクセストークン取得

`/device` ページはこれらを呼び出すフロントエンド。

---

## 動作確認手順

1. `.env` 設定完了
2. `pnpm dlx @better-auth/cli generate --config ./src/lib/auth.ts --output ./src/db/schema.ts` → schema生成
3. `pnpm drizzle-kit push` → DB反映
4. `/device` ページ実装
5. `pnpm run dev` でサーバー起動
6. `curl http://localhost:3000/health` → `{"status":"ok"}`
7. Device Flowテスト (CLI or curl)
