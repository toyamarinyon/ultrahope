# Scenario: Authenticated unpaid user is redirected to checkout

## Purpose

Verify that a signed-in account without an active Pro subscription cannot use protected web pages and is funneled directly into checkout.

## Scope

- `auth`
- `checkout`

## Method

- `browser`

## Preconditions

- App URL: target deployment URL for the current environment
- Environment: local or sandbox
- Auth state: signed in
- Account state: authenticated, unpaid, no active Pro subscription
- Required fixtures:
  - one unpaid account that can log in successfully
- Required env vars or flags:
  - none

## Steps

1. Sign in with the unpaid account.
2. Open `/`.
3. Open `/settings`.
4. Open `/pricing`.
5. Open `/device`.

## Expected

- `/` redirects into checkout.
- `/settings` redirects into checkout.
- `/pricing` does not behave as a normal logged-in page and also funnels into checkout.
- `/device` redirects into checkout instead of allowing device authorization to continue in unpaid state.

## Evidence

- Final URL after each navigation
- Screenshot of the checkout page or hosted checkout destination
- Any visible text confirming checkout has started

## Pass Criteria

- All protected pages tested above funnel an authenticated unpaid user into checkout.
- No protected page remains usable in unpaid state.

## Notes

- If the app uses an intermediate `/checkout/start` page before hosted checkout, that still counts as pass.
- If a hosted checkout URL is used, record both the local redirect source and the final hosted destination.
