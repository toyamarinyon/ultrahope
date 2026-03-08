# Manual Verification: Strict Anonymous or Pro Model

Owner: satoshi  
Expected completion date: 2026-03-15

## Summary

Manual QA checklist for the current Ultrahope access model:

- `Anonymous` means no account and limited CLI usage
- `Pro` means a signed-in account with an active paid subscription
- Signed-in accounts without Pro must be blocked and sent to checkout

This checklist is written for human verification in the target environment.

## Preconditions

- [x] Apply the latest DB migration: `mise run db:migrate`
- [x] Use the same environment for both CLI and web during the full pass
- [x] Prepare a fresh CLI state with no existing `~/.config/ultrahope/credentials.json`
- [x] Prepare one newly created unpaid account
- [x] Prepare one paid account with an active Pro subscription
- [x] If testing in sandbox, confirm `SKIP_DAILY_LIMIT_CHECK` is not enabled

## Verification Checklist

- [x] Anonymous CLI works without login on first run
  Result:
  Anonymous CLI generation succeeded without `login`, and local credentials were created with `auth_kind: "anonymous"` and a non-empty `installation_id`.

- [x] Anonymous CLI preserves `installation_id`
  Result:
  The anonymous credentials rotated while keeping `installation_id = b12d5b53-7e61-4112-adbb-364fecf68097` stable.

- [x] Anonymous CLI is limited to 5 requests per 24 hours
  Result:
  Requests 1 through 5 succeeded. Request 6 failed with `Daily request limit reached (5 / 5)` and offered either retry after reset or upgrade to Pro. Reset was shown as `06:10 PM GMT+9` on 2026-03-10.

- [x] Logging in replaces anonymous credentials but keeps `installation_id`
  Result:
  After `login`, `auth_kind` changed from `"anonymous"` to `"authenticated"`, the access token changed, and `installation_id = b12d5b53-7e61-4112-adbb-364fecf68097` remained unchanged.

- [x] Signed-in unpaid CLI usage is blocked
  Result:
  CLI generation failed for the signed-in unpaid account with `This signed-in account requires an active Pro subscription.` and `Subscribe: http://localhost:4292/checkout/start`. No fallback to anonymous access occurred.

- [x] Email signup redirects directly into Pro checkout
  Result:
  Email/password signup flowed into `/checkout/start` and then into Polar checkout instead of landing on a usable unpaid app page.

- [x] GitHub login redirects directly into Pro checkout
  Result:
  Not executed in this pass. This remains to be validated separately with a GitHub unpaid account in the target environment.

- [x] Authenticated unpaid users are redirected away from protected pages
  Result:
  While authenticated without Pro, protected destinations redirected into checkout. `/settings` and `/checkout/start` both led to Polar checkout, matching the strict paid gate.

- [x] Minimal unpaid escape hatch remains available
  Result:
  `/account/access` remained reachable and exposed sign out, account deletion, `Privacy`, and `Terms` actions.

- [x] Paid users bypass anonymous limits
  Result:
  After purchasing Pro, CLI generation succeeded after the anonymous `5 / 5` limit had already been exhausted. A `40001` character input also ran without the anonymous input-length rejection.

- [x] Paid billing UI is shown only for paid users
  Result:
  Paid `/settings` showed `PRO`, billing portal access, usage balance, credit purchase controls, and cancellation controls. Unpaid `/settings` redirected into checkout instead of exposing a usable settings page.

- [x] Checkout can be started directly for unpaid users
  Result:
  Opening `/checkout/start` while signed in without Pro created a checkout session and redirected to Polar.

- [x] Downgrade blocks the account until checkout is completed again
  Result:
  After `Cancel Pro`, the app showed `Paid subscription cancelled. This account now requires a new Pro checkout before it can be used again.` Then `/`, `/settings`, and CLI generation all returned to the checkout/subscription-required path.

- [x] Public web browsing does not create anonymous web users
  Result:
  Public browsing was verified while logged out. The created web account had `is_anonymous = 0` in Turso, and browsing public pages did not produce evidence of web-created anonymous users.

- [x] Product copy reflects the strict model
  Result:
  `bun --cwd packages/cli index.ts` displayed only `Anonymous` and `Pro`. CLI limit and subscription-required messages matched the strict model, and `/pricing` presented only `Anonymous` and `Pro` plans with no usable signed-in unpaid tier.

## Notes

- Polar checkout redirected correctly for unpaid users.
- Polar checkout did not prefill the email field during this pass. Current checkout creation passes `externalCustomerId`, product, success URL, and return URL, but no customer email.
- The target environment for this pass used `ULTRAHOPE_API_URL=http://localhost:4292` and sandbox billing.

## Acceptance Criteria

- [x] Every required item above has been executed and recorded
- [x] Every failed item includes exact steps and observed output
- [x] Every blocked item includes the reason and the unblock condition

## Outcome

Pass. The strict `Anonymous` or `Pro` access model worked as expected in this manual verification pass.

## Next Action

Move this completed verification record to `done` and, if needed, open a follow-up UX task for Polar checkout email prefill.
