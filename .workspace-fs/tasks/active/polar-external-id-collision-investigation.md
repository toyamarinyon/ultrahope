# Polar `external_id` Collision During Sign-up (Investigation)

Owner: satoshi  
Expected completion date: 2026-02-14  
Next action: implement sandbox-scoped `externalId` using Turso DB hostname label (keep production unchanged), then verify forked + shared-Polar scenarios.

## Summary

Sign-up failed with `500` because Polar customer creation failed with:

`A customer with this external ID already exists.`

This happened during top-up feature verification while using:

- a forked database (different app DB state),
- a shared Polar environment (same Polar org/token as another environment).

## Error observed

From app logs:

- `POST /api/auth/sign-up/email 500`
- Polar API validation error on `external_id` uniqueness:
  - `loc: ["body","external_id"]`
  - `msg: "A customer with this external ID already exists."`
  - `input: "9"`

## Findings

1. On sign-up, Better Auth + Polar plugin auto-creates a Polar customer:
   - `/Users/satoshi/repo/toyamarinyon/ultrahope/packages/web/lib/auth.ts:119`
   - `createCustomerOnSignUp: true`
2. Polar customer linkage uses app user ID as `externalId`:
   - `/Users/satoshi/repo/toyamarinyon/ultrahope/packages/web/lib/auth.ts:78`
   - `externalId: user.id`
3. User ID is numeric auto-increment:
   - `/Users/satoshi/repo/toyamarinyon/ultrahope/packages/web/db/schemas/auth-schema.ts:5`
   - `id ... autoIncrement: true`
4. Auth config explicitly uses serial IDs:
   - `/Users/satoshi/repo/toyamarinyon/ultrahope/packages/web/lib/auth.ts:147`
   - `generateId: "serial"`

## Root cause

`external_id` namespace is effectively shared across all environments that point to the same Polar account/token, while app `user.id` values are local to each database.

So when two DB instances both create user `id=9`, both try to create Polar customer with `external_id="9"`.  
The second attempt fails with uniqueness error.

## Why this appeared in this test

Top-up validation used a forked DB but not an isolated Polar environment, so ID sequences diverged from Polar state and collided.

## Mitigation options

1. Environment isolation (recommended for short-term safety)
- Use separate Polar org/token (or at least separate sandbox org) per fork/preview/dev environment.

2. Namespaced external IDs (recommended for long-term robustness)
- Build `externalId` as `{tursoDbScope}:{userId}` in non-production environments.
- Extract `tursoDbScope` from `TURSO_DATABASE_URL` hostname first label.
  - Example: `libsql://account-management-auto-recharge-toyamarinyon.aws-ap-northeast-1.turso.io` -> `account-management-auto-recharge-toyamarinyon`
- Keep production behavior unchanged: `externalId = user.id` (no namespace).

3. Collision-tolerant creation flow
- On "already exists" for customer creation, load by external ID and continue if ownership/context is valid.
- Still requires careful safeguards to avoid cross-environment data mixing.

## Operational note

If test cleanup scripts remove users from DB but keep a shared Polar dataset, raw serial IDs can be reused and collide again.

## Related decisions

- `./.workspace-fs/decisions/authentication.md`
- `./.workspace-fs/decisions/billing-free-plan-auto-subscription.md`
