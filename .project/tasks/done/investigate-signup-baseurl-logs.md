# Investigate signup baseUrl resolution with production logs

- **Goal**: Identify why `https://ultrahope.dev/signup` resolves to local URLs by logging `resolveBaseUrl` branching on Vercel.
- **Owner**: `@satoshi`
- **Expected completion date**: 2026-02-20
- **Next action**: Deploy branch to Vercel preview/production and capture `/signup` + `/api/auth` logs.

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
- [x] Vercel logs show `/signup` and `/api/auth` related entries with host resolution details.
- [x] A root cause is written in this task note (environment var source, branch, and expected fix direction).
- [x] Temporary logs are removed after cause is confirmed (or converted to safe, always-on diagnostics).

## Execution notes

- **f1e6fc3**: Changed `resolveBaseUrl` from receiving `process.env` as a whole object to receiving each `NEXT_PUBLIC_*` variable via explicit static property access. Also removed `PORT` fallback from production/preview log traces.

## Root cause

Next.js uses Webpack's **DefinePlugin** to inline `NEXT_PUBLIC_*` environment variables at build time. This replacement only matches the **static syntactic pattern** `process.env.NEXT_PUBLIC_XXX`. Any indirect or dynamic access—such as passing `process.env` as an object and reading properties from the alias—is **not recognized** by the plugin and therefore **not replaced**, leaving the values as `undefined` at runtime.

Before the fix, `resolveBaseUrl()` defaulted to `env = process.env`, and internal accesses like `env.NEXT_PUBLIC_VERCEL_ENV` were indirect lookups that DefinePlugin could not rewrite. On Vercel production, these evaluated to `undefined`, causing the function to fall through every branch and land on the `localhost-fallback`.

The fix (`f1e6fc3`) resolves this by accessing each variable with the static pattern (`process.env.NEXT_PUBLIC_VERCEL_ENV`, etc.) at the call site and passing the resolved values explicitly into the function.

**Reference**: [Next.js docs — Bundling Environment Variables for the Browser](https://nextjs.org/docs/pages/guides/environment-variables#bundling-environment-variables-for-the-browser)

> Note that dynamic lookups will *not* be inlined, such as:
> ```js
> const env = process.env
> setupAnalyticsService(env.NEXT_PUBLIC_ANALYTICS_ID) // NOT inlined
> ```

## References

- `./packages/web/lib/base-url.ts`
- `./packages/web/lib/auth-client.ts`
- `./packages/web/app/api/auth/[[...all]]/route.ts`
- `./packages/web/app/signup/page.tsx`
