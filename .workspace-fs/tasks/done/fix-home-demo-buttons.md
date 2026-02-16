# Fix homepage demo buttons interaction

Owner: satoshi

Context:
- On homepage, buttons `git commit`, `jj describe`, `unix style` appear to remain static and `Enter` can cause generic loading state.
- Demo terminal interactions should feel deterministic and visible.

Acceptance criteria:
- [x] Clicking each demo button transitions terminal output deterministically.
- [x] Keyboard interaction (focus + Enter/Space) mirrors click behavior.
- [x] No blank/indefinite `Loading...` state without content or purpose.
- [x] Regression checks were added/executed for the three demo actions.

Completed outcomes (2026-02-16):
- Added tab semantics in `packages/web/components/terminal-tabs-demo.tsx`:
  - `role="tablist"` on the tab container
  - `role="tab"` + `aria-selected` + `aria-controls` + `id` + `tabIndex` on each tab button
  - `role="tabpanel"` + `id` + `aria-labelledby` on the terminal panel
- Fixed Enter key conflict in global `keydown` handling:
  - In `waitingEnter`, Enter is ignored when the event target is interactive (`button`, `role=tab`, links, form controls, contenteditable, etc.).
  - This preserves native Enter/Space behavior for focused tabs and prevents accidental transition into analyzing/loading flow.
- Verified no visual regression with same-condition screenshots:
  - Before: `/tmp/ultrahope-home-before-stable.png`
  - After: `/tmp/ultrahope-home-after-stable.png`
  - Diff: `/tmp/ultrahope-home-diff.png` (`magick compare -metric AE` result: `0 (0)`)

Validation log:
- `bun --cwd packages/web typecheck` passed.
- `agent-browser` checks passed:
  - Enter on focused `jj describe` tab switches tab and does not trigger analyzing state.
  - Space on focused `unix style` tab switches tab and does not trigger analyzing state.
  - Click transitions for `git commit` / `jj describe` / `unix style` each produced matching command output.
  - `Loading...` text is not present on the homepage demo.
