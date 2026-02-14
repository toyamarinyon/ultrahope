# Fix homepage demo buttons interaction

Owner: satoshi

Context:
- On homepage, buttons `git commit`, `jj describe`, `unix style` appear to remain static and `Enter` can cause generic loading state.
- Demo terminal interactions should feel deterministic and visible.

Acceptance criteria:
- Clicking each demo button transitions terminal output deterministically.
- Keyboard interaction (focus + Enter/Space) mirrors click behavior.
- No blank/indefinite `Loading...` state without content or purpose.
- Add regression checks for the three demo actions.

Next action:
- Audit terminal/demo component state transitions and snapshot expected behavior per button.
