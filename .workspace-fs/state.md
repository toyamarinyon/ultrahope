## Design decisions

- Ultrahope provides CLI & API(Private)
- API built by ElysiaJS
- CLI built by TypeScript but framework(authentication, arg parser, logging, observability) is not yet
- CLI authentication with Device Flow
- CLI destributes on npm


## Next

- [x] **Create packages/core: separate LLM logic** → [decisions/core-package.md](decisions/core-package.md)
  - [x] Initialize `packages/core/` (package.json, tsconfig.json)
  - [x] Move types, prompts, providers
  - [x] Switch `packages/web/src/lib/llm/` to use core + billing wrapper
  - [x] Verify behavior (web → core → Cerebras API, device auth, CLI translate)
- [x] `packages/cli` publish prep
  - [x] Verify translate command (after Minimax API implementation)
  - [x] npm publish
- [ ] `packages/web` remaining tasks → [decisions/web-package.md](decisions/web-package.md)
  - [ ] Account management
  - [x] Pricing / billing (Polar.sh integration) — Better Auth Polar plugin integration complete
  - [ ] API Playground
- [x] Adjust Polar.sh Benefits/Meters (details: [decisions/billing-meter-design.md](decisions/billing-meter-design.md))
  - Create Consumed Tokens Meter (sum over `tokens`)
  - Token-based Benefits: Free 400K, Pro 1M tokens/month
- [x] **Implement meter balance check**
  - [x] Check balance via Polar API before running translate
  - [x] Return error response on insufficient balance (HTTP 402)
- [ ] Production deploy (Vercel + ultrahope.dev domain)


## Task (Human)

Environment variables needed alongside development:

- [x] **Turso** — `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
    - `turso auth signup` → `turso db create ultrahope` → `turso db tokens create ultrahope`
- [x] **GitHub OAuth** — `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
    - GitHub Settings > Developer settings > OAuth Apps
    - Callback URL: `https://api.ultrahope.dev/auth/callback/github` (production) / `http://localhost:3000/auth/callback/github` (development)
- [x] **Resend** — `RESEND_API_KEY`
    - Create an account at https://resend.com → API Keys

Needed later:
- [x] **Minimax API** — `MINIMAX_API_KEY` (during translate implementation)
- [x] **Polar.sh** — the following environment variables are required:
    - `POLAR_ACCESS_TOKEN` — create in Organization Settings > Access Tokens
    - `POLAR_WEBHOOK_SECRET` — generated when configuring webhooks
    - `POLAR_PRODUCT_FREE_ID` — Free plan Product ID
    - `POLAR_PRODUCT_PRO_ID` — Pro plan Product ID
- [x] **Domain** — ultrahope.dev was acquired


## Done
- [x] **LLM provider migration: Minimax → Cerebras** → [decisions/llm-provider-abstraction.md](decisions/llm-provider-abstraction.md)
  - Install `@cerebras/cerebras_cloud_sdk`, build LLM abstraction layer
  - Environment variables: `CEREBRAS_API_KEY`, remove `@anthropic-ai/sdk`
- [x] **Monolith migration: merge API into Web** → [decisions/monolith-migration.md](decisions/monolith-migration.md)
  - Move `packages/api` code into `packages/web/src/{db,lib}`
  - Export Elysia via Route Handler (`app/api/[[...slugs]]/route.ts`)
  - Remove `packages/api`
- [x] `packages/web` initial setup (Next.js + Landing page + Device verification page)
- [x] Make `tsc --noEmit` runnable with zero errors
- [x] Add code formatting & dead-code detection (Biome + knip)
- [x] Billing decision → [decisions/billing.md](decisions/billing.md) (choose Polar.sh)
- [x] Authentication approach → [decisions/authentication.md](decisions/authentication.md) (choose Better Auth)
- [x] Design API server from CLI to-be → [to-be/api.md](to-be/api.md)
- [x] Consider CLI implementation approach → [decisions/cli-implementation.md](decisions/cli-implementation.md)
- [x] Revisit CLI implementation: cmd-ts → custom thin wrapper
- [x] Think through project structure → [decisions/project-structure.md](decisions/project-structure.md)
- [x] Organize `.workspace-fs` structure
- [x] Infrastructure selection → [decisions/infrastructure.md](decisions/infrastructure.md) (Vercel + Turso + Minimax + Resend)
- [x] Project initialization (pnpm workspaces + packages/cli, packages/api)
- [x] API implementation (Better Auth + Device Flow + translate endpoint)
- [x] CLI implementation (translate, login commands)
- [x] Environment variable setup (Turso, GitHub OAuth, Resend)
- [x] DB schema generation & push (Better Auth CLI + drizzle-kit)
- [x] Local verification (CLI login → Device Flow auth success)
- [x] CLI README.md creation & package.json prep (npm publish prep)
