# Improve SEO metadata and sharing previews

Owner: satoshi

Context:
- Public pages need production-ready SEO and social sharing metadata before announcement.

Acceptance criteria:
- Ensure each key page has clear title/description and canonical URL.
- Configure Open Graph / Twitter card metadata for homepage and pricing.
- Validate no duplicate/placeholder metadata and no missing `og:title`/`og:description` on important pages.
- Confirm robots and sitemap are aligned with canonical URL policy.

Completed outcomes:
- Added shared SEO utility at `./packages/web/lib/seo.ts` for canonical URL resolution, noindex metadata helper, and shared defaults.
- Updated metadata on key public pages with explicit title/description/canonical and OG/Twitter metadata:
  - `./packages/web/app/page.tsx`
  - `./packages/web/app/pricing/page.tsx`
  - `./packages/web/app/privacy/page.tsx`
  - `./packages/web/app/terms/page.tsx`
- Added noindex metadata for non-canonical routes (auth/private/utility), including route-level layouts for client pages:
  - `./packages/web/app/login/layout.tsx`
  - `./packages/web/app/signup/layout.tsx`
  - `./packages/web/app/forgot-password/layout.tsx`
  - `./packages/web/app/reset-password/layout.tsx`
  - `./packages/web/app/device/layout.tsx`
  - `./packages/web/app/home/page.tsx`
  - `./packages/web/app/settings/page.tsx`
  - `./packages/web/app/checkout/success/page.tsx`
- Aligned robots/sitemap with canonical policy:
  - `./packages/web/app/robots.ts`
  - `./packages/web/app/sitemap.ts`
  - `./packages/web/lib/sitemap-pages.ts`
- Added SEO guardrail tests at `./packages/web/lib/seo.test.ts`.

Validation:
- `bun run --cwd packages/web test` passed.
- `bun run --cwd packages/web typecheck` passed.
