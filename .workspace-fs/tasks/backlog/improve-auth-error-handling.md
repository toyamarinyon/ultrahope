# Improve authentication error handling and UX

Owner: satoshi

Context:
- Auth flows currently surface raw API validation payloads on signup.
- Browser logs show URL and fetch failures that should be surfaced as user-friendly feedback.

Acceptance criteria:
- Sign-up/sign-in/forgot-password errors are normalized into concise user-facing messages.
- Preserve validation detail internally (logging) without exposing raw JSON payloads in UI.
- Add tests or checks for invalid email domain and auth API failures.
- Ensure `URL_INVALID` style console noise is not user-facing.

Next action:
- Introduce error mapping layer in auth pages and display actionable messages in inline alert area.
