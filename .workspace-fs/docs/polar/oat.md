# Polar Organization Access Token (OAT) for packages/web

This doc describes the required Polar OAT scopes for `packages/web` and how to
create the token for production or sandbox.

## Scope requirements (current usage)

`packages/web/src/lib/auth.ts` uses the Better Auth Polar plugin with:
- `createCustomerOnSignUp: true`
- `checkout(...)`
- `portal()`
- `webhooks(...)` (signature verification only)

Required scopes:
- `customers:write` - create customers on signup (`POST /v1/customers/`)
- `checkouts:write` - create checkout sessions (`POST /v1/checkouts/`)
- `customer_sessions:write` - create customer portal sessions (`POST /v1/customer-sessions/`)

No OAT scope is required for webhook signature verification itself.

Optional scopes (only if features are enabled later):
- `events:write` - usage plugin event ingestion (`POST /v1/events/ingest`)
- `meters:read` - usage plugin reads meters (`GET /v1/meters/`)
- `customers:read` - any explicit customer lookups or state reads

## Environment notes

- OATs are tied to a single organization.
- Production and sandbox are fully isolated; create a separate OAT in each.
- `packages/web` uses sandbox unless `NODE_ENV=production`.
  See `packages/web/src/lib/auth.ts` (`server: "sandbox"` vs "production").

## Create an OAT (manual)

1. Open the Polar dashboard for the target environment.
   - Production: https://polar.sh
   - Sandbox: https://sandbox.polar.sh
2. Select the organization (ultrahope or ultrahope sandbox).
3. Go to Organization Settings > Access Tokens.
4. Create a new token with the scopes listed above.
5. Copy the token and store it securely.

## Set the env var

Set the token as `POLAR_ACCESS_TOKEN` in your deployment environment.
Use the sandbox token for local dev and the production token for prod.
