# Apply Entitlement UI Guard To Translate Selector

## Summary

Extend the entitlement-aware selector behavior to `ultrahope translate --target vcs-commit-message` so it matches `git ultrahope commit` and `ultrahope jj describe`.

## Owner

- Codex + satoshi

## Expected Completion Date

- 2026-03-13

## Next Action

- Wire entitlement capability resolution into `packages/cli/commands/translate.ts` for the interactive `vcs-commit-message` path.

## Problem

The current implementation updates selector capability behavior for:

- `git ultrahope commit`
- `ultrahope jj describe`

But `ultrahope translate --target vcs-commit-message` still shows `Escalate`, even for anonymous users, because its interactive selector path does not yet use entitlement capability resolution.

## Expected Behavior

- Anonymous users do not see `Escalate`
- Authenticated users use the same local entitlement cache behavior as other interactive CLI commands
- Background entitlement refresh can hide `Escalate` after initial render for unpaid authenticated users
- Forced Pro-tier model requests are still enforced server-side through `command_execution`

## Acceptance Criteria

- [ ] `translate --target vcs-commit-message` resolves entitlement capability before interactive selection
- [ ] Anonymous users do not see `Escalate`
- [ ] Authenticated users follow the same optimistic/cache-backed behavior as `commit` and `jj`
- [ ] Relevant CLI tests are added or updated

