# Infrastructure Decisions

## Deploy: Vercel

**Decision**: Vercel を使う

**Rationale**:
- ElysiaJS は Edge Runtime 対応
- Turso との統合実績あり（Val Town, Prisma Optimize等）
- ドメイン管理も Vercel Domains で統一できる

## Database: Turso (SQLite)

**Decision**: Turso を使う

**Rationale**:
- API仕様がシンプル（Device Flow + translate endpoint）で複雑なリレーション不要
- SaaS認証/課金での利用実績多数
- Free tier: 500 databases / Scaler: 10,000 databases ($29/mo)
- Drizzle ORM との相性良好
- Edge から低レイテンシアクセス可能

**Schema概要** (想定):
```sql
-- users
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- device_codes (for Device Flow auth)
CREATE TABLE device_codes (
  device_code TEXT PRIMARY KEY,
  user_code TEXT UNIQUE NOT NULL,
  user_id TEXT REFERENCES users(id),
  expires_at TEXT NOT NULL,
  authorized_at TEXT
);

-- access_tokens
CREATE TABLE access_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## LLM API: Minimax 2.1 (初期)

**Decision**: 初期は Minimax 2.1 (Claude互換API) を使う

**Rationale**:
- Claude互換APIで実装しやすい
- 将来的に grok-code-fast-1, Gemini-3 Flash, GPT-5.2 等への切り替えを想定
- Provider抽象化レイヤーを設ける

## Email: Resend

**Decision**: Resend を使う（Magic Link用）

**Rationale**:
- シンプルなAPI
- 開発者向けサービスとの相性良い

## Monitoring: Vercel Observability

**Decision**: 初期は Vercel Observability で十分

**Rationale**:
- 追加設定不要
- 将来的に必要なら Sentry 等を追加
