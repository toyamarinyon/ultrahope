# Verify Git CLI Pro Model Guard

## Summary

Run manual verification for the `git ultrahope commit` flow in a separate Git repository to confirm that the new Pro-tier entitlement behavior matches the verified `jj describe` behavior.

## Owner

- satoshi

## Expected Completion Date

- 2026-03-13

## Next Action

- Run `git ultrahope commit` in a disposable Git repository with anonymous credentials and confirm that `Escalate` is hidden.

## Why This Exists

- `jj describe` has already been manually verified.
- `git ultrahope commit` should follow the same selector capability rules.
- Verification should happen in a separate repository to avoid interference with the current workspace state.

## Verification Goals

- Anonymous users do not see `Escalate` in `git ultrahope commit`
- Pro-tier model requests are still rejected server-side if forced manually
- Interactive selection still works normally without the `Escalate` action

## Suggested Manual Steps

1. Remove local auth and entitlement cache for the target environment.
2. Create or use a disposable Git repository with staged changes.
3. Run `git ultrahope commit`.
4. Confirm that the selector hint does not include `Escalate`.
5. Optionally force a Pro-tier model through `--models` and confirm server rejection.

## Acceptance Criteria

- [ ] `git ultrahope commit` hides `Escalate` for anonymous users
- [ ] `git ultrahope commit --models <pro-model>` is rejected with `subscription_required`
- [ ] No regression is observed in normal interactive commit selection

