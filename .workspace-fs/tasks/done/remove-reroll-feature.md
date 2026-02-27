# Remove reroll feature

## Context

The reroll feature is rarely used and has a bug where the process exits after outputting candidates. The maintenance cost is not justified, so we are removing it entirely.

## Outcome

- Status updated: Done (implemented 2026-02-27).
- Removed reroll from shared selector contracts, CLI selector handling, CLI command loops, web selector controller/demo, tests, and CLI docs.

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

- [x] All reroll-related code is removed
- [x] `mise run format` passes
- [x] Existing tests pass (reroll tests themselves are deleted)
- [x] CLI commit / translate / jj commands work correctly without reroll
- [x] Task moved to done state

## Execution Notes

- Updated shared types/actions:
  - `packages/shared/terminal-selector-view-model.ts`
  - `packages/shared/terminal-selector-contract.ts`
- Updated CLI selector loop and command handlers:
  - `packages/cli/lib/selector.ts`
  - `packages/cli/commands/commit.ts`
  - `packages/cli/commands/translate.ts`
  - `packages/cli/commands/jj.ts`
- Updated web controller/demo:
  - `packages/web/lib/util/terminal-selector.ts`
  - `packages/web/components/terminal-tabs-demo.tsx`
  - `packages/web/lib/util/terminal-selector-view-model.test.ts`
- Updated docs:
  - `packages/cli/README.md`

## Validation

- `mise run format` (passed)
- `bun test packages/web/lib/util/terminal-selector-view-model.test.ts` (passed)
- `bun run --cwd packages/cli typecheck` (passed)
- `bun run --cwd packages/web typecheck` (passed)
