# Polar `external_id` Collision During Sign-up (Investigation)

Owner: satoshi  
Expected completion date: 2026-02-17

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
   - `./packages/web/lib/auth.ts:119`
   - `createCustomerOnSignUp: true`
2. Polar customer linkage uses app user ID as `externalId`:
   - `./packages/web/lib/auth.ts:78`
   - `externalId: user.id`
3. User ID is numeric auto-increment:
   - `./packages/web/db/schemas/auth-schema.ts:5`
   - `id ... autoIncrement: true`
4. Auth config explicitly uses serial IDs:
   - `./packages/web/lib/auth.ts:147`
   - `generateId: "serial"`

## Root cause

`external_id` namespace is effectively shared across all environments that point to the same Polar account/token, while app `user.id` values are local to each database.

So when two DB instances both create user `id=9`, both try to create Polar customer with `external_id="9"`.  
The second attempt fails with uniqueness error.

## Why this appeared in this test

Top-up validation used a forked DB but not an isolated Polar environment, so ID sequences diverged from Polar state and collided.

## Important constraint discovered (2026-02-13)

- Current `@polar-sh/better-auth` plugin behavior effectively forces `externalId = user.id` when `createCustomerOnSignUp: true`.
- `getCustomerCreateParams` does not expose `externalId` override; only `metadata` is configurable in types.
- The plugin hardcodes `user.id` in 5 places:
  - `onBeforeUserCreate`: `customers.create` (created without externalId)
  - `onAfterUserCreate`: updates with `externalId = user.id`
  - `onUserUpdate`: syncs email/name via `externalId: user.id`
  - `onUserDelete`: looks up by email and deletes
  - portal/state/benefits/subscriptions endpoints: uses `externalCustomerId: user.id`
- App-side namespacing helper (`{tursoDbScope}:{userId}`) works for direct SDK callsites, but does not affect the signup auto-create/update path in this plugin mode.

## Mitigation options considered

### ❌ Option 1: Namespaced external IDs (`getPolarExternalId` helper)

- Build `externalId` as `{tursoDbScope}:{userId}` in non-production environments.
- **Problem**: The `@polar-sh/better-auth` plugin hardcodes `user.id`, so the signup auto-create path and portal endpoints cannot use the namespaced ID. The plugin's `externalId` and the app-side namespaced ID would be inconsistent.
- **Rejected**: This would require an irregular plugin usage pattern and a switch to self-managed customer creation, which is a significant change on its own.

### ❌ Option 2: Switch to UUID/nanoid (`generateId` change)

- Replacing serial IDs with globally unique IDs would eliminate collisions across all environments.
- **Problem**: In SQLite, `INTEGER PRIMARY KEY` is the rowid itself — no separate index needed, compact varint storage, and sequential inserts are optimal for B-tree (always append). Switching to string IDs loses these performance characteristics.
- **Rejected**: Requires migration of existing data and sacrifices performance benefits. Overkill for a problem that only affects branch environments.

### ❌ Option 3: Async notification to parent DB on branch user creation

- When a user is created on a branch DB, send a message to increment the parent DB's `sqlite_sequence` by 1.
- **Problem**: Requires building and maintaining messaging infrastructure (queue + worker). A collision window still exists during message processing lag if another branch creates a user concurrently.
- **Rejected**: Infrastructure cost does not justify the scope of the problem (branch/dev/test environments only).

### ✅ Option 4: Random `sqlite_sequence` offset at DB fork time (adopted)

- After forking a Turso DB, offset the fork's `sqlite_sequence` by a random large value.
- The parent DB is never modified. Only the fork is changed.
- SQLite `INTEGER PRIMARY KEY` supports values up to 2^63 (~9.2 quintillion), so offsetting by 1M–10M per fork makes collisions practically impossible.
- **Advantages**: Preserves serial ID performance characteristics. No plugin code changes. No runtime dependencies. Zero infrastructure additions.
- **Caveat**: Bumping the parent's seq would cause parent and fork to start from the same value — only the fork must be offset.

## Target state

1. **Branch environment sign-ups do not collide**: Each forked DB's user IDs start from a different range, so even when sharing the same Polar sandbox, `external_id` values never overlap.
2. **Production is unaffected**: The production DB is never touched. Serial ID performance characteristics are preserved.
3. **Environment setup completes in a single command**: Manual steps (Turso dashboard GUI, copy-pasting tokens/URLs, setting Vercel env vars) are consolidated into one script.

## Next action: DB fork automation script

### Problem being solved

Current branch environment setup is manual and error-prone:

1. Create fork via Turso dashboard GUI
2. Manually retrieve token and URL
3. Manually copy into `.mise.<env>.toml`
4. Manually set Vercel preview environment variables via GUI

実行手順: `bun scripts/fork-db.ts <branch-name>` で fork / シーケンスオフセット / Vercel preview env upsert を一括実施し、続けて `bun x vercel env pull --cwd packages/web --git-branch <branch-name> --environment preview` を実行。

If the seq offset step is missed during this process, the Polar `external_id` collision will recur.

### Script design

```
bun scripts/fork-db.ts <branch-name>
```

Dependencies:
- `@tursodatabase/api` — DB fork creation, token issuance
- `@libsql/client` — `sqlite_sequence` offset (already used in the project)
- `@vercel/sdk` — branch-scoped environment variable configuration

Flow:

1. **Fork Turso DB** (`@tursodatabase/api`)
   - `databases.create(name, { seed: { type: "database", name: parentDb } })`
2. **Create token** (`@tursodatabase/api`)
   - `databases.createToken(name)`
3. **Apply seq offset** (`@libsql/client`)
   - Connect to fork DB and run `UPDATE sqlite_sequence SET seq = seq + <random 1M–10M> WHERE name = 'user'`
4. **Set Vercel environment variables** (`@vercel/sdk`)
   - `projects.createProjectEnv({ target: ["preview"], gitBranch, upsert: "true", ... })`
   - Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` scoped to the branch
5. **Print local setup instructions**
   - `bun x vercel env pull --cwd packages/web --git-branch <branch> --environment preview`

### Local development workflow

```bash
# Fork DB + set Vercel env vars
bun scripts/fork-db.ts feature-topup

# Pull env to local
bun x vercel env pull --cwd packages/web --git-branch feature-topup --environment preview

# Run migrations
bun x vercel env run --cwd packages/web -- bun x drizzle-kit migrate

# Start dev server
bun x vercel env run --cwd packages/web -- bun dev
```

## Operational note

If test cleanup scripts remove users from DB but keep a shared Polar dataset, raw serial IDs can be reused and collide again. The seq offset approach prevents this by ensuring each fork uses a non-overlapping ID range.

## Current status

- The fork automation implementation is in place (`scripts/fork-db.ts`) and includes
  - branch DB fork
  - randomized `user` sequence offset
  - preview-scoped Vercel env upsert
  - usage guidance for `bun x vercel env pull --cwd packages/web ...`
- This is sufficient for this task's objective.
- End-to-end execution validation is deferred until next actual branch environment setup; no regressions are expected from current changes.

## Related decisions

- `./.workspace-fs/decisions/authentication.md`
- `./.workspace-fs/decisions/billing-free-plan-auto-subscription.md`
