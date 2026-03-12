# Apply Entitlement UI Guard To Translate Selector

## Summary

Extend the entitlement-aware selector behavior to `ultrahope translate --target vcs-commit-message` so it matches `git ultrahope commit` and `ultrahope jj describe`.

## Owner

- Codex + satoshi

## Expected Completion Date

- 2026-03-13

## Next Action

- No further action. Move to `done/` after review.

## Problem

The current implementation updates selector capability behavior for:

- `git ultrahope commit`
- `ultrahope jj describe`

But `ultrahope translate --target vcs-commit-message` still shows `Escalate`, even for anonymous users, because its interactive selector path does not yet use entitlement capability resolution.

## Expected Behavior

- Anonymous users do not see `Escalate`
- Authenticated users use the same local entitlement cache behavior as other interactive CLI commands
- Background entitlement refresh can hide `Escalate` after initial render for unpaid authenticated users
- Pro users can use the same escalate action and `escalation_models` behavior as `commit` and `jj describe`
- Forced Pro-tier model requests are still enforced server-side through `command_execution`

## Discussion Notes

- Reuse the existing CLI pattern from `git ultrahope commit` and `ultrahope jj describe` rather than designing a translate-specific entitlement path.
- `translate --target vcs-commit-message` should support the full interactive escalate flow, not just hide/show the selector affordance.
- For test coverage, prefer extracting small helpers from `translate.ts` and unit testing those decisions instead of adding a new command-level interactive test harness in this task.
- Keep scope limited to the `vcs-commit-message` interactive path; non-interactive targets do not need entitlement-aware selector changes here.

## Outcomes

- Wired entitlement capability resolution into [`packages/cli/commands/translate.ts`](./packages/cli/commands/translate.ts) for the interactive `vcs-commit-message` flow.
- Added the same interactive escalate transition used by `commit` and `jj describe`, including switching to configured `escalation_models` and clearing transient refinement state on escalate.
- Extracted `decideVcsCommitMessageSelection()` so the selector transition logic can be tested directly without introducing a new command-level interactive harness.
- Added focused unit coverage in [`packages/cli/commands/translate.test.ts`](./packages/cli/commands/translate.test.ts).

## Validation

- `bun test packages/cli/commands/translate.test.ts packages/cli/lib/selector.test.ts`
- `bun --cwd packages/cli typecheck`
- `mise run format`

## Acceptance Criteria

- [x] `translate --target vcs-commit-message` resolves entitlement capability before interactive selection
- [x] Anonymous users do not see `Escalate`
- [x] Authenticated users follow the same optimistic/cache-backed behavior as `commit` and `jj`
- [x] Pro users can trigger escalate and switch to `escalation_models` in `translate --target vcs-commit-message`
- [x] Relevant CLI tests are added or updated
