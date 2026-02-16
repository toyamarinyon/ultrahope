# Refactor terminal-tabs-demo phase management with useReducer

Owner: satoshi

Context:
- `packages/web/components/terminal-tabs-demo.tsx` manages terminal simulation state across 7 phases using multiple `useState` + `useEffect` hooks scattered throughout the component.
- The tab UI itself is minimal (just `activeTab` switching) — adding a library like base-ui would not meaningfully reduce complexity.
- The real verbosity comes from phase transitions resetting several pieces of state (`typedText`, `spinnerFrame`, `generatedCount`, `selectedIndex`, `slots`) independently, making the flow hard to follow.

Acceptance criteria:
- [ ] Consolidate `phase`, `typedText`, `spinnerFrame`, `generatedCount`, `selectedIndex`, and `slots` into a single `useReducer` state.
- [ ] Replace scattered `setPhase` / `setTypedText` / `setSlots` / etc. calls with typed action dispatches (e.g., `TICK_TYPE`, `START_ANALYZING`, `SLOT_READY`, `SELECT`, `REROLL`).
- [ ] Each phase transition resets only the relevant fields inside the reducer — no more relying on separate `useEffect` hooks to sync resets.
- [ ] No user-facing behavior change: typing animation, spinner, slot generation timing, keyboard interactions, and tab switching must remain identical.
- [ ] Component renders and phase transitions remain correct (manual verification in browser).

Next action:
- Define the reducer state shape and action types, then migrate one phase at a time starting with the `initial → typing` transition.
