# Investigate signup baseUrl resolution with production logs

- **Goal**: Identify why `https://ultrahope.dev/signup` resolves to local URLs by logging `resolveBaseUrl` branching on Vercel.
- **Owner**: `@satoshi`
- **Expected completion date**: 2026-02-20
- **Next action**: Add temporary instrumentation in `./packages/web/lib/base-url.ts` and deploy to staging/production.

## Background

- Recent behavior suggests `resolveBaseUrl` falls back to localhost in production.
- The issue appears before auth API execution, so we need environment-derived branches in `base-url` to be observable.

## Plan

1. Add structured debug logs in `resolveBaseUrl` for:
   - input env snapshot (only env keys used in this function)
   - chosen override source
   - branch taken (`override`, `production`, `preview`, `window-origin`, `localhost-fallback`)
   - final `baseUrl` value
2. Add a follow-up cleanup step to remove logs after root cause is identified.
3. Deploy branch to Vercel preview or production.
4. From browser, open `/signup` and capture:
   - any auth requests to `/api/auth/...`
   - resolved origin and base url from server logs
5. Compare logs from Vercel preview/production to determine whether:
   - `VERCEL_ENV`/`VERCEL_PROJECT_PRODUCTION_URL` are missing or differ
   - or `NEXT_PUBLIC_*` fallback mismatch is still used
   - or other branch returns localhost.

## Acceptance criteria

- [x] `./packages/web/lib/base-url.ts` outputs one structured log line per `resolveBaseUrl` call.
- [x] Log includes branch identifier and final resolved URL (`console.log("[base-url] resolveBaseUrl", ...)` in `./packages/web/lib/base-url.ts`).
- [ ] Vercel logs show `/signup` and `/api/auth` related entries with host resolution details.
- [ ] A root cause is written in this task note (environment var source, branch, and expected fix direction).
- [ ] Temporary logs are removed after cause is confirmed (or converted to safe, always-on diagnostics).

## References

- `./packages/web/lib/base-url.ts`
- `./packages/web/lib/auth-client.ts`
- `./packages/web/app/api/auth/[[...all]]/route.ts`
- `./packages/web/app/signup/page.tsx`
