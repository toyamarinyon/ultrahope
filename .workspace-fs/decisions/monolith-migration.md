# API/Web モノリス化

## 結論: packages/api を packages/web に統合

### 背景

現状の構成:
- `packages/api` — ElysiaJS (Better Auth + Device Flow + translate)
- `packages/web` — Next.js (Landing page + Device verification page)

**問題:**
- Vercelに2プロジェクト必要 → コスト増
- CORS/セッション共有の複雑さ
- デプロイ・運用の手間

### 解決策

Next.js App Router の Route Handler で ElysiaJS を動かす。

```
packages/web/src/app/api/[[...slugs]]/route.ts
```

ElysiaJS は WinterTC 準拠なので、Next.js の Route Handler として export するだけで動く。

### 技術的根拠

1. **ElysiaJS + Next.js 公式サポート**
   - https://elysiajs.com/integrations/nextjs

2. **Vercel Bun ランタイム (Public Beta)**
   - https://vercel.com/blog/bun-runtime-on-vercel-functions
   - `vercel.json` に `"bunVersion": "1.x"` を追加するだけ
   - ElysiaJS の Bun 最適化がそのまま活きる
   - `@elysiajs/node` アダプター不要

3. **Eden による End-to-End Type Safety**
   - フロントエンドから API を型安全に呼び出せる
   - tRPC 的な DX

### 実装手順

1. `packages/web/src/app/api/[[...slugs]]/route.ts` 作成
2. `packages/api/src` のコードを移動
   - `lib/auth.ts` → `packages/web/src/lib/auth.ts`
   - `lib/llm.ts` → `packages/web/src/lib/llm.ts`
   - `db/` → `packages/web/src/db/`
3. Route Handler で Elysia app を export
4. `vercel.json` に Bun ランタイム設定追加
5. `packages/api` を削除
6. root の `package.json` から api workspace を削除

### 考慮事項

#### Better Auth の basePath

現在 `basePath: "/api"` で設定されている。Next.js 統合後も同じパスで動くか確認必要。

```typescript
// 現在
export const auth = betterAuth({
  basePath: "/api",
  // ...
})
```

#### 環境変数

`packages/api` 用の環境変数を `packages/web` に移動:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `RESEND_API_KEY`
- `DEVICE_VERIFICATION_URI`

#### GitHub OAuth Callback URL

統合後は同一オリジンになるので、Callback URL を更新:
- 本番: `https://ultrahope.dev/api/auth/callback/github`
- 開発: `http://localhost:3000/api/auth/callback/github`

#### Cold Start

Bun ランタイムは Node.js より cold start が遅い傾向がある（Vercel ブログより）。
ただし CPU-intensive な処理では 28% 高速化されるとのこと。

#### pnpm peer dependencies

pnpm を使っている場合、追加の依存関係が必要:
```bash
pnpm add @sinclair/typebox openapi-types
```
（現在は Bun workspaces なので不要かもしれない）

### ディレクトリ構成 (After)

```
packages/
├── cli/          # CLI (変更なし)
└── web/          # Next.js + ElysiaJS API
    ├── src/
    │   ├── app/
    │   │   ├── api/
    │   │   │   └── [[...slugs]]/
    │   │   │       └── route.ts    # ElysiaJS エントリポイント
    │   │   ├── device/
    │   │   │   └── page.tsx
    │   │   ├── dashboard/          # 新規: ログイン後の画面
    │   │   │   └── page.tsx
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── db/                     # api から移動
    │   │   ├── client.ts
    │   │   └── schema.ts
    │   └── lib/                    # api から移動
    │       ├── auth.ts
    │       └── llm.ts
    ├── vercel.json
    └── package.json
```

### 参考リンク

- [ElysiaJS Next.js Integration](https://elysiajs.com/integrations/nextjs)
- [Vercel Bun Runtime](https://vercel.com/blog/bun-runtime-on-vercel-functions)
- [Eden Treaty](https://elysiajs.com/eden/treaty/overview)
