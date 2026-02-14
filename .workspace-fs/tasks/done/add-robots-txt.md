# Add robots.txt for production crawling control

Owner: satoshi

Context:
- https://ultrahope.dev previously returned 404 for `/robots.txt`.
- Search crawler behavior and indexing rules could not be controlled without this file.

Acceptance criteria:
- [x] `/robots.txt` returns valid content on production.
- [x] `User-agent`, `Disallow`, and `Allow` rules are explicitly defined.
- [x] Important pages (`/login`, `/forgot-password`, API paths) are protected as needed.
- [x] Sitemap location is included.

Implemented:
- Added `./packages/web/app/robots.ts` using Next.js `MetadataRoute.Robots`.
- Added the following rules:
  - `User-agent: *`
  - `Disallow: /login`, `/forgot-password`, `/reset-password`, `/api`
  - `Allow: /`, `/pricing`, `/privacy`, `/terms`, `/home`
  - `Sitemap: https://ultrahope.dev/sitemap.xml`
- Replaced the previous `robots.txt route handler` approach with the `robots.ts` metadata route (Next.js recommended shape).

Notes:
- Runtime verification (status 200 + `Content-Type: text/plain`) should be confirmed in deployed environment.
