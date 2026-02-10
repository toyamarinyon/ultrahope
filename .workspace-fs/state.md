## Design decisions

- Ultrahope provides CLI & API(Private)
- API built by ElysiaJS
- CLI built by TypeScript but framework(authentication, arg parser, logging, observability) is not yet
- CLI authentication with Device Flow
- CLI destributes on npm


## Next

- [x] **Core/Web unification + OpenAPI export** → [tasks/core-web-unify-openapi-plan.md](tasks/core-web-unify-openapi-plan.md)
- [ ] **Free plan daily limit** → [decisions/free-plan-daily-limit.md](decisions/free-plan-daily-limit.md)
  - [x] Create decision doc
  - [x] Add `daily_usage` table to Turso (user_id, date, count)
  - [x] Implement daily limit check in API (5 requests/day, UTC reset)
  - [x] Update 402 response for daily limit exceeded
  - [x] Remove `free_credits` benefit from Polar
  - [x] Update pricing page UI (show "5 requests/day" + reset time in user TZ)
  - [ ] **Redesign usage tracking** → [tasks/usage-tracking-redesign.md](tasks/usage-tracking-redesign.md)
    - Count per CLI command (session), not per API request
    - New tables: `cli_sessions`, `api_requests` for better observability
- [ ] **Account management**
  - [ ] **Billing & plan change**
    - [ ] Pro → Free downgrade (Polar `subscriptions.cancel()` + recreate Free subscription, or delegate to Polar portal)
    - [ ] Link to Polar customer portal (`portal()` plugin already enabled; add link from settings page)
    - [ ] Billing history display
  - [ ] **Account deletion** (Privacy Policy compliance: GDPR, CCPA)
    - [x] Phase 1: Operational script `scripts/delete-user.ts` (manual "Contact us" flow)
      - [x] Delete Polar customer (`customers.delete()`)
      - [x] Revoke GitHub OAuth token (GitHub API `DELETE /applications/{client_id}/grant`)
      - [x] Delete Turso user (CASCADE removes all related rows)
      - [x] Add safety controls (`--dry-run` default, `--execute --confirm <email>` required)
      - Runbook:
        - Dry run: `mise run delete-user:dry-run <user@example.com>`
        - Execute: `mise run delete-user:execute <user@example.com> <user@example.com>`
    - [ ] Phase 2: Self-service API endpoint + settings UI
  - [ ] **Settings UI** (unified account settings page for all of the above)
- [ ] **Multi-model generation** → [to-be/multi-model-generation.md](to-be/multi-model-generation.md)
  - [x] Migrate to Vercel AI Gateway (for `total_cost` per request)
  - [ ] Update billing to USD-based credits → [decisions/billing-model-v2.md](decisions/billing-model-v2.md)
    - [x] Design: Zed-style pricing (subscription + included credit, microdollars unit)
    - [x] Update `polar-sync.ts` (new meter "Usage Cost", USD-based benefits)
    - [x] Event ingestion update (microdollars)
    - [x] Update balance check logic (use new meter via `POLAR_USAGE_COST_METER_ID`)
    - [x] Remove metered price from Pro (no automatic overage)
    - [x] Add one-time credit products (Credit $10, Credit $20)
    - [ ] Apply to sandbox with `--recreate` flag
    - [ ] Apply to production
    - [x] Update 402 response with new actions (`buyCredits`, `enableAutoRecharge`)
    - [ ] Implement auto-recharge feature:
      - [ ] Add `autoRecharge` settings to user model (`enabled`, `threshold`, `amount`)
      - [ ] Check threshold after usage events
      - [ ] Create Polar checkout when balance falls below threshold
    - [ ] Build settings UI for credit purchases + auto-recharge toggle
  - [x] Add `models` param to translate API
  - [x] Update selector UI to show model name per candidate
  - [ ] Build settings UI for user model preferences
- [x] **Jujutsu (jj) integration** → [to-be/jj-subcommand.md](to-be/jj-subcommand.md)
  - [x] Add `jj` subcommand to main CLI
  - [x] Implement `ultrahope jj describe` command
  - [ ] Test with real jj repository
- [x] **Interactive selector** (applies to all translate-based commands)
  - [x] Add `n` parameter to translate API for multiple candidates
  - [x] Build shared interactive selector UI component
  - [x] Update `ultrahope translate` with selector
  - [x] Update `git ultrahope commit` with selector
  - [x] Implement `ultrahope jj describe` with selector
- [x] **Git subcommand integration** → [to-be/git-subcommand.md](to-be/git-subcommand.md)
  - [x] Add `git-ultrahope` bin entry to package.json
  - [x] Implement `git ultrahope commit` command
  - [x] Test global install flow
- [x] **Create packages/core: separate LLM logic** → [decisions/core-package.md](decisions/core-package.md)
  - [x] Initialize `packages/core/` (package.json, tsconfig.json)
  - [x] Move types, prompts, providers
  - [x] Switch `packages/web/src/lib/llm/` to use core + billing wrapper
  - [x] Verify behavior (web → core → Cerebras API, device auth, CLI translate)
- [x] `packages/cli` publish prep
  - [x] Verify translate command (after Minimax API implementation)
  - [x] npm publish
- [ ] `packages/web` remaining tasks → [decisions/web-package.md](decisions/web-package.md)
  - ~~Account management~~ → consolidated into top-level "Account management" task
  - [x] Add Email/Password auth alongside GitHub OAuth
    - `/login`: sign in + sign up with email/password
    - `/device`: unauthenticated state supports email/password auth
    - Password reset flow: `/forgot-password` and `/reset-password`
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
