# Local development setup tasks

## Overview

Three tasks to run the API (`packages/web`) locally.

## Working Directory

**Run all commands from the `packages/web` directory.**

```bash
cd packages/web
```

---

## 1. Environment variable setup

### Goal
Create `.env` from `.env.example` and set prepared credentials.

### Prerequisites
- Turso DB is created
- GitHub OAuth App is created
- Resend API key is obtained

### Configuration items

| Variable | Description | Source |
|------|------|--------|
| `TURSO_DATABASE_URL` | `libsql://xxx.turso.io` format | `turso db show ultrahope` |
| `TURSO_AUTH_TOKEN` | DB token | `turso db tokens create ultrahope` |
| `GITHUB_CLIENT_ID` | OAuth App ID | GitHub Developer Settings |
| `GITHUB_CLIENT_SECRET` | OAuth App Secret | GitHub Developer Settings |
| `RESEND_API_KEY` | For sending email | Resend Dashboard |
| `EMAIL_FROM` | Sender address | Optional (e.g. `noreply@ultrahope.dev`) |
| `DEVICE_VERIFICATION_URI` | For development: `http://localhost:3000/device` | - |
| `MINIMAX_API_KEY` | ⚠️ Set later (for translate) | - |

### Notes
- The server can start without `MINIMAX_API_KEY`, but `/v1/translate` will fail.
- Make sure the GitHub OAuth App callback URL is `http://localhost:3000/api/callback/github`.

---

## 2. DB schema generation

### Goal
Create tables required by Better Auth (user, session, account, device_authorization, etc.) in Turso DB.

### Command

```bash
pnpm dlx @better-auth/cli generate --config ./src/lib/auth.ts --output ./src/db/schema.ts
```

- `--config` — specify the auth.ts location (defaults to searching project root)
- `--output` — specify schema output path (match `schema` in drizzle.config.ts)

### How Better Auth CLI works
The command above:
1. Parses the `auth.ts` config (including plugins)
2. Generates required table definitions in Drizzle schema format
3. Writes to the path specified by `--output`

### Flow after generation
```
@better-auth/cli generate  →  src/db/schema.ts generated
                                    ↓
pnpm drizzle-kit push      →  Create tables in Turso DB
```

### Generated tables (expected)
- `user` - user info
- `session` - login sessions
- `account` - OAuth account linkage (GitHub, etc.)
- `verification` - email verification / Magic Link
- `device_authorization` - Device Flow code management

### When re-run is needed
Typically only once. Re-run only when:
- Better Auth plugins are added/removed
- Better Auth is upgraded (schema changes)

### Notes
- After generating the schema file, `db/client.ts` may need updated imports.
- Review the schema before running `drizzle-kit push`.

---

## 3. Device Verification Page (`/device`)

### Goal
Landing page for the URL shown by the CLI in Device Flow. The user enters a `user_code` and authenticates via GitHub/Magic Link.

### Flow

```
CLI: ultrahope login
  ↓
POST /api/device/code
  → device_code, user_code, verification_uri
  ↓
CLI: "Open http://localhost:3000/device and enter: ABCD-1234"
  ↓
User: open /device in the browser
  ↓
/device page:
  1. user_code input form
  2. Submit → POST /api/device/verify (validate user_code)
  3. Select auth method (GitHub Login or Magic Link)
  4. Auth success → mark device_code as approved
  ↓
CLI: polling POST /api/device/token
  → obtain access_token, save to ~/.ultrahope/credentials
```

### Page implementation approach

#### Option A: Return HTML from API (simple)
Return HTML directly with ElysiaJS. No external dependencies.

```typescript
app.get('/device', () => {
  return new Response(/* HTML */, {
    headers: { 'Content-Type': 'text/html' }
  })
})
```

#### Option B: Web UI in a separate package
Create `packages/web` and build with SvelteKit/Next.js, later integrate with dashboards, etc.

### Current recommendation
Build the MVP with **Option A**. Keep the HTML template minimal (Tailwind CDN ok). Later migration to Option B is possible.

### Required endpoints (Better Auth Device Flow)
Provided by the Better Auth device-authorization plugin:
- `POST /api/device/code` - issue device code
- `POST /api/device/verify` - validate user_code
- `POST /api/device/token` - obtain access token

The `/device` page is the frontend that calls these.

---

## Verification steps

1. `.env` configured
2. `pnpm dlx @better-auth/cli generate --config ./src/lib/auth.ts --output ./src/db/schema.ts` → schema generated
3. `pnpm drizzle-kit push` → apply to DB
4. Implement `/device` page
5. Start server with `pnpm run dev`
6. `curl http://localhost:3000/health` → `{"status":"ok"}`
7. Device Flow test (CLI or curl)
