# Scenario: Unpaid CLI login is redirected to checkout before authorization completes

## Purpose

Verify that starting from anonymous CLI usage and attempting `ultrahope login` with an unpaid account does not grant authenticated CLI access, and instead funnels the user into checkout before device authorization completes.

## Scope

- `auth`
- `cli`

## Method

- `hybrid`

## Preconditions

- App URL: target deployment URL for the current environment
- Environment: local or sandbox
- Auth state: starts anonymous
- Account state: an unpaid account exists and can sign in, but has no active Pro subscription
- Required fixtures:
  - a staged git diff or equivalent input for commit-message generation
  - a valid unpaid account
- Required env vars or flags:
  - if using sandbox, set `ULTRAHOPE_ENV=sandbox`

## Steps

1. Start from anonymous CLI state with a valid local `installation_id`.
2. Run `ultrahope login` and note the device authorization URL and user code.
3. Open the device authorization flow in the browser and sign in with the unpaid account if needed.
4. Observe what happens when the unpaid account reaches `/device`.
5. Inspect the credentials file after the browser flow settles.
6. Confirm the CLI does not receive an authenticated session on the same machine and config.

## Expected

- The browser is funneled into checkout before device authorization can be approved.
- `/device` does not remain usable for an authenticated unpaid account.
- The credentials file does not change from anonymous to authenticated state.
- The stored `installation_id` is preserved.
- The CLI does not silently obtain authenticated access or silently convert the session into a usable unpaid account.

## Evidence

- Credentials file before login
- Device code and authorization URL printed by the CLI
- Final browser URL after the unpaid account reaches checkout
- Credentials file after the browser flow
- Screenshot of the checkout destination

## Pass Criteria

- `ultrahope login` does not produce an authenticated CLI session for an unpaid account.
- The unpaid user is redirected toward checkout before device authorization completes.
- The local anonymous installation identity is not replaced during the blocked login attempt.

## Notes

- This scenario intentionally covers both terminal and browser steps.
- This scenario is specifically about the login/device flow being intercepted by checkout, not about post-login authenticated unpaid usage.
- If device authorization completes and CLI credentials become authenticated for an unpaid account, record that as failure because it violates the strict model.
