# Add robots.txt for production crawling control

Owner: satoshi

Context:
- https://ultrahope.dev currently returns 404 for /robots.txt.
- Search crawler behavior and indexing rules cannot be controlled without this file.

Acceptance criteria:
- `/robots.txt` returns valid content on production.
- `User-agent`, `Disallow`, and `Allow` rules are explicitly defined.
- Important pages (`/login`, `/forgot-password`, API paths) are protected as needed.
- Include sitemap location if available (e.g. `Sitemap: https://ultrahope.dev/sitemap.xml`).

Next action:
- Implement and verify `/robots.txt` is served with `Content-Type: text/plain` and 200 response.
