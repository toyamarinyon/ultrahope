# Add and serve a favicon

Owner: satoshi

Context:
- https://ultrahope.dev/favicon.ico returns 404.
- Browsers and link previews show missing icon for the site.

Acceptance criteria:
- `/favicon.ico` returns 200 and caches appropriately.
- Include standard sizes for modern browsers (at minimum 32x32/16x16 and/or `.svg` if supported).
- Ensure favicon is referenced from site head metadata.

Next action:
- Add icon asset pipeline and verify `/favicon.ico` is available on production pages.
