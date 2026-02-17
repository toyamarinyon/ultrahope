# Improve authentication error handling and UX

Owner: satoshi

Context:
- Auth flows currently surface raw API validation payloads on signup.
- Browser logs show URL and fetch failures that should be surfaced as user-friendly feedback.

Acceptance criteria:
- [x] Sign-up/sign-in/forgot-password errors are normalized into concise user-facing messages.
- [x] Preserve validation detail internally (logging) without exposing raw JSON payloads in UI.
- [x] Add tests or checks for invalid email domain and auth API failures.
- [x] Ensure `URL_INVALID` style console noise is not user-facing.

Completed outcomes:
- Added shared auth error normalization layer in `./packages/web/lib/auth-error.ts`.
- Added checks in `./packages/web/lib/auth-error.test.ts` for:
  - invalid email domain handling
  - known auth API failures (`INVALID_EMAIL_OR_PASSWORD`, `URL_INVALID`, `INVALID_TOKEN`)
  - fallback behavior for unknown/raw JSON payloads
  - forgot-password failure path guard (`submitted` should not become success on error)
- Updated auth UI flows to use mapped user-facing messages and keep raw details in internal logs:
  - `./packages/web/app/login/page.tsx`
  - `./packages/web/app/signup/page.tsx`
  - `./packages/web/app/forgot-password/page.tsx`
  - `./packages/web/app/device/page.tsx`
- Standardized user-facing auth error messages in English.

Validation:
- `bun test packages/web/lib/auth-error.test.ts` passed (`11 pass / 0 fail`).
- `mise run ok` completed on the implementer side after integration.
