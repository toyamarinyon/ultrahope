# Infrastructure Decisions

## Deploy: Vercel

**Decision**: Use Vercel

**Rationale**:
- ElysiaJS supports the Edge Runtime
- Proven integration with Turso (Val Town, Prisma Optimize, etc.)
- Domain management can be unified with Vercel Domains

## Database: Turso (SQLite)

**Decision**: Use Turso

**Rationale**:
- API surface is simple (Device Flow + translate endpoint), no complex relationships needed
- Widely used for SaaS auth/billing
- Free tier: 500 databases / Scaler: 10,000 databases ($29/mo)
- Good compatibility with Drizzle ORM
- Low-latency access from the Edge

**Schema overview** (expected):
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

## LLM API: Minimax 2.1 (initial)

**Decision**: Start with Minimax 2.1 (Claude-compatible API)

**Rationale**:
- Claude-compatible API is easy to implement
- Plan to switch to grok-code-fast-1, Gemini-3 Flash, GPT-5.2, etc. later
- Provide an abstraction layer for providers

## Email: Resend

**Decision**: Use Resend (for Magic Link)

**Rationale**:
- Simple API
- Good fit for developer-focused services

## Monitoring: Vercel Observability

**Decision**: Vercel Observability is sufficient initially

**Rationale**:
- No extra configuration required
- Add Sentry, etc. later if needed
