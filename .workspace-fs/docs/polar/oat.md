# Polar Organization Access Token (OAT) for packages/web

This doc describes the required Polar OAT scopes for `packages/web` and how to
create the token for production or sandbox.

## Scope requirements

### Runtime (Next.js / Vercel)

`packages/web/src/lib/auth.ts` uses the Better Auth Polar plugin with:
- `createCustomerOnSignUp: true`
- `checkout(...)`
- `portal()`
- `webhooks(...)` (signature verification only)

Required scopes:
- `customers:write` - create customers on signup (`POST /v1/customers/`)
- `customers:read` - get customer state for idempotency check (`GET /v1/customers/external/{id}/state`)
- `checkouts:write` - create checkout sessions (`POST /v1/checkouts/`)
- `customer_sessions:write` - create customer portal sessions (`POST /v1/customer-sessions/`)
- `subscriptions:write` - auto-create free subscription on signup (`POST /v1/subscriptions/`)
- `events:write` - ingest token consumption events for usage-based billing (`POST /v1/events/ingest`)

No OAT scope is required for webhook signature verification itself.

### Sync script (polar-sync.ts)

`packages/web/scripts/polar-sync.ts` manages Meters, Benefits, and Products idempotently.

Required scopes:
- `meters:read` - list meters (`GET /v1/meters/`)
- `meters:write` - create/update meters (`POST /v1/meters/`)
- `benefits:read` - list benefits (`GET /v1/benefits/`)
- `benefits:write` - create/update benefits (`POST /v1/benefits/`)
- `products:read` - list products (`GET /v1/products/`)
- `products:write` - create/update products (`POST /v1/products/`)

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
