# Remove reroll feature

## Context

The reroll feature is rarely used and has a bug where the process exits after outputting candidates. The maintenance cost is not justified, so we are removing it entirely.

## Scope

Remove all reroll-related code, UI, and documentation from the following files.

### shared (view model / contract)
- `packages/shared/terminal-selector-view-model.ts` — Remove reroll state and label definitions
- `packages/shared/terminal-selector-contract.ts` — Remove reroll action and result types

### CLI
- `packages/cli/lib/selector.ts` — Remove reroll keybinding and selection logic
- `packages/cli/commands/commit.ts` — Remove reroll action handling
- `packages/cli/commands/translate.ts` — Remove reroll action handling
- `packages/cli/commands/jj.ts` — Remove reroll action handling
- `packages/cli/README.md` — Remove reroll keyboard shortcut documentation

### Web
- `packages/web/lib/util/terminal-selector.ts` — Remove reroll function and result handling
- `packages/web/components/terminal-tabs-demo.tsx` — Remove reroll action handling
- `packages/web/lib/util/terminal-selector-view-model.test.ts` — Remove reroll-related tests

## Acceptance criteria

- [ ] All reroll-related code is removed
- [ ] `mise run format` passes
- [ ] Existing tests pass (reroll tests themselves are deleted)
- [ ] CLI commit / translate / jj commands work correctly without reroll
