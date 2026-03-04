# Add sitemap.xml for discoverability

Owner: satoshi

Context:
- https://ultrahope.dev/sitemap.xml currently returns 404.
- Crawlers do not get a structured index of important pages.

Best-practice notes (Next.js):
- Implement sitemap in App Router using `app/sitemap.ts` and return `MetadataRoute.Sitemap`.
- Use route-level metadata (`lastModified`, `changeFrequency`, `priority`) for maintainable SEO metadata.
- Keep URL entries in one source-of-truth list so additions/updates are low-risk.

Implementation:
- Added `./packages/web/app/sitemap.ts` using `MetadataRoute.Sitemap`.
- Added `./packages/web/lib/sitemap-pages.ts` as the canonical public page list.
- Included canonical public pages required by this task:
  - `/`
  - `/pricing`
  - `/login`
  - `/terms`
  - `/privacy`
  - `/forgot-password`
- Set `lastModified`, `changeFrequency`, and `priority` for each sitemap entry.
- Added canonical origin resolution with fallback to `https://ultrahope.dev` for stable production indexing.

Acceptance check:
- [x] `/sitemap.xml` exists and returns XML successfully.
- [x] Includes top, pricing, login, terms, privacy, forgot-password.
- [x] `lastmod` and `priority` are set.
- [x] URL list is managed in a maintainable static definition file.

Verification:
- `bun run --cwd packages/web typecheck` passed.
- `bun run --cwd packages/web build` passed and route output includes `○ /sitemap.xml`.

References:
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
- https://nextjs.org/docs/app/api-reference/functions/generate-sitemaps
- https://www.sitemaps.org/protocol.html
