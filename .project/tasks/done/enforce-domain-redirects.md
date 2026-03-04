# Enforce canonical domain redirect behavior

Owner: satoshi

Context:
- Redirect behavior between http/https and www/non-www variants should be explicit before launch.

## Policy decision

- Canonical domain: `https://ultrahope.dev` (non-www)
- `www.ultrahope.dev` → `ultrahope.dev` (permanent redirect via Vercel Dashboard)
- `http → https` is handled automatically by Vercel with a 308 redirect (no config needed)
- 308 is equivalent to 301 for SEO purposes (identical behavior for GET requests)

## Acceptance criteria

- [x] Define canonical domain policy (https + non-www)
- [x] Configure www → non-www redirect in Vercel Dashboard
- [x] Verify login and pricing URLs preserve path and query correctly

## Dashboard setup steps

1. Vercel Dashboard → Project → Settings → Domains
2. Add `www.ultrahope.dev` if not already present
3. Edit `www.ultrahope.dev` → set "Redirect to" to `ultrahope.dev`
4. Keep the default status code (308)

## Verification results

- `https://www.ultrahope.dev/` → 308 → `https://ultrahope.dev/`
- `https://www.ultrahope.dev/login?redirect=/dashboard` → 308 → `https://ultrahope.dev/login?redirect=/dashboard`
- `https://www.ultrahope.dev/pricing?plan=pro` → 308 → `https://ultrahope.dev/pricing?plan=pro`
