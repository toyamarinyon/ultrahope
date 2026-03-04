# Add and serve a favicon

Owner: satoshi

Context:
- https://ultrahope.dev/favicon.ico returns 404.
- Browsers and link previews show missing icon for the site.

Acceptance criteria:
- [x] `/favicon.ico` returns 200 and caches appropriately.
- [x] Include standard sizes for modern browsers (at minimum 32x32/16x16 and/or `.svg` if supported).
- [x] Ensure favicon is referenced from site head metadata.

Outcome:
- `packages/web/app/favicon.ico` — standard ICO favicon
- `packages/web/app/icon.svg` — scalable vector icon
- Next.js App Router automatically serves `/favicon.ico` and injects `<link>` tags in `<head>`.
