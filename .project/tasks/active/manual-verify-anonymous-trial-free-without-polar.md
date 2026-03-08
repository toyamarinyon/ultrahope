# Manual Verification: Anonymous Trial + Free-Without-Polar Refactor

Owner: satoshi  
Expected completion date: 2026-03-15

## Summary

Manual verification checklist for the anonymous CLI trial, DB-only Free accounts, and Polar-backed paid billing after the auth and billing refactor.

## Preconditions

- [ ] Apply the DB migration before testing: `mise run db:migrate`
- [ ] Prepare a fresh CLI environment with no existing `~/.config/ultrahope/credentials.json`
- [ ] Prepare a newly created Free account with no paid subscription
- [ ] Prepare a paid account with an active Pro subscription
- [ ] Prepare a legacy account that still has an old Free Polar subscription, if available
- [ ] Use the same target environment for CLI and web during the full test pass

## Verification Checklist

- [ ] Anonymous CLI first run works without login
  Operation:
  Move or remove `~/.config/ultrahope/credentials.json`, stage a small git change, then run `git diff --staged | ultrahope translate --target vcs-commit-message`.
  Expected:
  The command succeeds without requiring `ultrahope login`, and `~/.config/ultrahope/credentials.json` is created with `auth_kind: "anonymous"`.

- [ ] Anonymous CLI usage is limited to 5 total runs
  Operation:
  Repeat the same CLI generation command until the sixth run.
  Expected:
  Runs 1 through 5 succeed. Run 6 fails with an anonymous trial limit message that tells the user to run `ultrahope login`.

- [ ] Logging in from anonymous state replaces the stored credentials
  Operation:
  After anonymous usage, run `ultrahope login`, complete device auth, and then run the generation command again.
  Expected:
  Login succeeds, the next generation succeeds, and `credentials.json` now contains `auth_kind: "authenticated"`.

- [ ] Authenticated Free users still have `5/day` and `40,000` character limits
  Operation:
  Log in with a new Free account, run 5 successful generation requests, then a 6th request on the same day. Also submit an input larger than `40,000` characters.
  Expected:
  The first 5 requests succeed, the 6th returns the daily limit error, and oversized input returns the Free-plan input length error.

- [ ] A normal Free account works without any Polar-backed customer
  Operation:
  Use a newly created account that has never upgraded. Run a CLI generation, then open `/pricing` and `/settings`.
  Expected:
  Generation works as Free, no billing-unavailable error appears, Pricing shows Free as current, and Settings does not depend on paid billing state.

- [ ] Paid users bypass Free quotas and use paid billing behavior
  Operation:
  Log in with a paid account, run more than 5 generation requests in one day, and submit input larger than `40,000` characters.
  Expected:
  Requests continue to succeed past the Free daily limit, large input is accepted, and the account is treated as Pro.

- [ ] Paid billing UI only appears for paid users
  Operation:
  Open `/settings` with a paid account, then with a Free account.
  Expected:
  Paid users see the billing portal, credit purchase controls, and billing history. Free users do not see paid billing sections.

- [ ] New Free users can upgrade directly to Pro
  Operation:
  Sign in as a new Free account, open `/pricing`, and start the Pro checkout flow.
  Expected:
  The Pro checkout opens directly and does not depend on an existing Free Polar subscription.

- [ ] Downgrade returns the user to Free without creating a new Free Polar subscription
  Operation:
  From a paid account, use the downgrade action in `/settings`, refresh the page, and run a CLI generation again. If Polar state is available, inspect the resulting subscription state.
  Expected:
  The account returns to Free behavior, paid billing controls disappear, Free limits apply again, and no new Free Polar subscription is created during downgrade.

- [ ] Legacy Free-subscription users can still upgrade cleanly
  Operation:
  Sign in as a legacy account that still has an old Free Polar subscription, open `/pricing`, and upgrade to Pro.
  Expected:
  Checkout succeeds, the current plan becomes Pro afterward, and the account does not end up in a broken or duplicate-plan state.
  If unavailable:
  Mark this check blocked and note that no legacy test account was available.

- [ ] Web browsing does not auto-create anonymous users
  Operation:
  While logged out, browse public pages such as `/`, `/pricing`, and `/login`. If DB visibility is available, compare anonymous-user count before and after.
  Expected:
  Public web browsing alone does not create anonymous users or guest sessions.

- [ ] User-facing copy matches the new behavior
  Operation:
  Check `ultrahope --help`, the anonymous trial exhaustion message in the CLI, `/pricing`, `/settings`, `/privacy`, and `/terms`.
  Expected:
  The product copy mentions the anonymous CLI trial, Free is described as account-based rather than Polar-managed, and Polar is described as paid-billing-only.

## Acceptance Criteria

- [ ] All required checks above have been executed and recorded
- [ ] Any failures include reproduction steps and observed output
- [ ] Any blocked checks include a concrete unblock condition

## Next Action

Run this checklist against the target deployment, then update this task with outcomes and move it to `done` or `blocked` based on results.
