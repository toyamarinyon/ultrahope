# Refactor terminal-tabs-demo phase management with useReducer

Owner: satoshi

Context:
- `packages/web/components/terminal-tabs-demo.tsx` manages terminal simulation state across 7 phases using multiple `useState` + `useEffect` hooks scattered throughout the component.
- The tab UI itself is minimal (just `activeTab` switching) — adding a library like base-ui would not meaningfully reduce complexity.
- The real verbosity comes from phase transitions resetting several pieces of state (`typedText`, `spinnerFrame`, `generatedCount`, `selectedIndex`, `slots`) independently, making the flow hard to follow.

Acceptance criteria:
- [x] Consolidate `phase`, `typedText`, `spinnerFrame`, `generatedCount`, `selectedIndex`, and `slots` into a single `useReducer` state.
- [x] Replace scattered `setPhase` / `setTypedText` / `setSlots` / etc. calls with typed action dispatches (e.g., `TICK_TYPE`, `START_ANALYZING`, `SLOT_READY`, `SELECT`, `REROLL`).
- [x] Each phase transition resets only the relevant fields inside the reducer — no more relying on separate `useEffect` hooks to sync resets.
- [x] No user-facing behavior change: typing animation, spinner, slot generation timing, keyboard interactions, and tab switching must remain identical.
- [x] Component renders and phase transitions remain correct (manual verification in browser).

Completed outcomes (2026-02-16):
- Refactored `packages/web/components/terminal-tabs-demo.tsx` to use a single reducer state (`DemoState`) for phase flow and simulation state (`typedText`, `spinnerFrame`, `generatedCount`, `selectedIndex`, `slots`).
- Added typed action dispatches (`DemoAction`) and a pure `demoReducer` to handle all phase transitions and state resets (`RESET_FOR_TAB`, `START_GENERATING`, `SLOT_READY`, `SELECT`, `REROLL`, etc.).
- Migrated all transition effects, keyboard handlers, and slot interactions to reducer dispatches while preserving existing timing constants and interaction behavior.
- Kept tab API/markup/semantics unchanged and preserved current spinner behavior on generating/reroll transitions (no frame reset).

Validation log:
- `bun --cwd packages/web typecheck` passed.
- Browser interaction checks on `http://localhost:3001` via `agent-browser` passed:
  - Verified `initial -> typing -> waitingEnter` flow and command typing for `git commit`, `jj describe`, and `unix style`.
  - Verified Enter on terminal content transitions waiting state into analyzing (`Found ...` lines shown).
  - Verified Enter/Space on focused tabs switches tabs without incorrectly triggering analyzing.
  - Verified selector navigation and confirmation with `ArrowUp`/`ArrowDown`/`j`/`k` + Enter.
  - Verified reroll (`r`) works from both selected and selector states.
  - Verified tab switching resets the demo flow back to command typing/waiting state.
