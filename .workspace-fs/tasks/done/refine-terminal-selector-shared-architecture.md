# Refine terminal-selector shared architecture after PR #17

Owner: satoshi

## Context

PR #17 introduced a runtime-agnostic selector contract (`packages/shared/terminal-selector-contract.ts`) and a browser-side `createTerminalSelectorController` so the web demo can reuse the same interactive selection UX as the CLI. This was a meaningful step toward a shared orchestration layer.

### What works well today

- **`terminal-selector-contract.ts` as the single source of truth for types.** Both CLI and web now import `CandidateWithModel`, `SelectorSlot`, `SelectorResult`, etc. from one place. This eliminates type drift between runtimes.
- **`createTerminalSelectorController` is a clean, framework-agnostic state machine.** It owns slot management, candidate ingestion, key handling, and selection — all with a subscribe/emit pattern that any UI layer (React, Ink, raw TTY) can consume. The `handleKey` → `SelectorResult | null` contract is particularly clean.
- **`commit-message.ts` was correctly split into a runtime-agnostic core** (`CommitMessageRuntimeOptions` accepts `streamText`'s model type directly) and a server adapter (`commit-message.server.ts` that calls `resolveModel` + `buildResponse`). This layering is right.
- **The demo stays client-only with mock data.** No server route or API call on every page view — the demo uses `DEMO_USE_MOCK = true` and renders purely in the browser, which is the correct tradeoff.

### What can be improved

The shared contract types are in place, but the *logic* that operates on those types is still duplicated or unnecessarily layered. The improvements below focus on consolidating that logic without changing the architecture's direction.

## Improvements

### 1. Remove the Effect dependency from `terminal-selector-effect.ts`

**Files:** `./packages/web/lib/terminal-selector-effect.ts`, `./packages/web/package.json`

`createCandidatesFromEffectTasks` wraps each task in `Effect.tryPromise` → `Effect.runPromise`, which is equivalent to a plain `try/catch`. None of Effect's real strengths (structured concurrency, dependency injection, retry combinators) are used. The same Promise.race-over-pending-map pattern is then reimplemented inside `consumeCandidates` in `terminal-selector.ts`, making the Effect layer redundant.

Replace `createCandidatesFromEffectTasks` with a plain `createCandidatesFromTasks` that directly runs the task promises and yields results via the existing `CreateCandidates` contract. Remove the `effect` dependency from `packages/web/package.json`.

Acceptance criteria:
- [x] `terminal-selector-effect.ts` no longer imports `effect`.
- [x] `effect` removed from `packages/web/package.json`.
- [x] Demo behavior unchanged (mock candidates still appear with staggered timing).
- [x] `bun --cwd packages/web typecheck` passes.

### 2. Remove the unused `generateCommitMessage` import from the demo

**Files:** `./packages/web/components/terminal-tabs-demo.tsx`

Line 4 imports `generateCommitMessage` from `@/lib/llm/commit-message`. Since `DEMO_USE_MOCK` is always `true`, this code path is never reached, but the import pulls `ai` SDK internals (`streamText`, etc.) into the client bundle.

Remove the import and the `generateCommitMessage` call path inside `activateCandidateTask`. If a real-API demo mode is needed in the future, it should call a dedicated API route (not a direct LLM call from the client) — but that is out of scope here.

Acceptance criteria:
- [x] No import from `@/lib/llm/commit-message` in `terminal-tabs-demo.tsx`.
- [x] `activateCandidateTask` only handles the mock path.
- [x] `bun --cwd packages/web typecheck` passes.

### 3. Consolidate shared selector helpers into `packages/shared`

**Files:** `./packages/shared/terminal-selector-contract.ts`, `./packages/web/lib/terminal-selector.ts`, `./packages/cli/lib/selector.ts`

The following pure functions exist in near-identical form in both `cli/lib/selector.ts` and `web/lib/terminal-selector.ts`:

| Function | CLI | Web |
|---|---|---|
| `formatModelName` | ✓ | ✓ |
| `formatCost` | ✓ | ✓ |
| `formatTotalCostLabel` | ✓ | ✓ |
| `getReadyCount` | ✓ | ✓ |
| `getTotalCost` | ✓ | ✓ |
| `getLatestQuota` | ✓ | ✓ |
| `hasReadySlot` | ✓ | ✓ |
| `selectNearestReady` | ✓ | ✓ |
| `getSelectedCandidate` | ✓ | ✓ |

Additionally, CLI defines its own `Slot` type that is structurally identical to `SelectorSlot` from the contract.

Move these helpers into `packages/shared/` (either in the existing contract file or a new `terminal-selector-helpers.ts`). Remove the CLI's local `Slot` type in favor of `SelectorSlot`.

Acceptance criteria:
- [ ] Shared helpers live in `packages/shared/`.
- [ ] CLI `selector.ts` imports helpers from shared instead of defining its own.
- [ ] Web `terminal-selector.ts` imports helpers from shared instead of defining its own.
- [ ] CLI's local `Slot` type is replaced by `SelectorSlot` from the contract.
- [ ] `bun --cwd packages/cli typecheck` and `bun --cwd packages/web typecheck` pass.

### 4. Extract a shared async-race utility for candidate ingestion

**Files:** `./packages/shared/`, `./packages/web/lib/terminal-selector.ts` (L356–404), `./packages/cli/lib/vcs-message-generator.ts` (L214–233)

The "race N async iterators, yield whichever resolves first, handle abort" pattern is implemented three times:
1. `consumeCandidates` in `terminal-selector.ts`
2. The main loop in `vcs-message-generator.ts`
3. `createCandidatesFromEffectTasks` (removed by improvement #1, but the pattern remains in the controller)

Extract a single `raceAsyncIterables` (or similar) utility into `packages/shared/` that both the controller's `consumeCandidates` and the CLI generator can use.

Acceptance criteria:
- [ ] A shared utility in `packages/shared/` handles the race-and-yield pattern.
- [ ] `consumeCandidates` in `terminal-selector.ts` uses the shared utility.
- [ ] `vcs-message-generator.ts` uses the shared utility.
- [ ] Existing tests (if any) and typecheck pass.

### 5. Simplify demo component state management

**Files:** `./packages/web/components/terminal-tabs-demo.tsx`

The component currently has 5 `useState` hooks and 8 `useEffect` hooks laid out flat. The `selectorTick` state exists solely to drive spinner frame calculation, causing a full re-render every 80ms during generation.

Suggested approach:
- Extract typing animation into a `useTypingAnimation(command, enabled)` hook.
- Replace `selectorTick` with a CSS animation or `requestAnimationFrame`-based approach that doesn't trigger React re-renders.
- Consider grouping `phase` / `selectedResult` into a `useReducer` to make phase transitions explicit (note: the previous `useReducer` in the done task was replaced by the controller pattern — the new reducer should be thin and delegate to the controller, not duplicate its logic).

Acceptance criteria:
- [ ] Typing animation logic is extracted from the main component.
- [ ] Spinner animation does not cause React state updates every 80ms.
- [ ] No user-facing behavior change.
- [ ] `bun --cwd packages/web typecheck` passes.

## Priority order

1. **#2** — Remove unused import (trivial, immediate bundle win)
2. **#1** — Remove Effect dependency (small scope, removes a dependency)
3. **#3** — Consolidate shared helpers (medium scope, eliminates drift risk)
4. **#4** — Shared async-race utility (medium scope, depends on #1 and #3)
5. **#5** — Demo state cleanup (medium scope, independent but lower urgency)

## Constraints

- The demo **must remain client-only with mock data**. Do not introduce server routes or server actions for demo generation — each page view would incur an API call.
- Changes should be incremental. Each improvement can be landed as a separate PR.
