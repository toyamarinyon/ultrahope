# Align terminal-tabs-demo rendering with CLI using shared SelectorRenderLine

Owner: satoshi
Expected completion date: 2026-03-06
Next action: Run browser verification on the marketing homepage once `packages/web` can be served locally without the unrelated port `3000` app, the `.next/dev/lock` conflict, or Google Fonts fetch failures during build.

## Motivation

The CLI's terminal selector UI has grown richer (edit, refine, escalate capabilities; structured header/slot/hint rendering), but `terminal-tabs-demo.tsx` still manually reconstructs the selector UI with custom JSX — bypassing the shared `buildSelectorRenderLines` abstraction. This causes the demo to visually diverge from the real CLI output.

`marketing-control-loop-section.tsx` already solved this problem: it consumes `buildSelectorRenderLines` → `SelectorRenderLine[]` and maps each line to a React element via a `RenderLine` component. The same approach should be applied to `terminal-tabs-demo.tsx`.

### Current divergence summary

| Aspect | CLI (actual) | Demo (current) |
|--------|-------------|----------------|
| Header (done) | `✔ Generated 3 commit messages (total: $0.001)` | Custom spinner replacement logic via `renderSelectorLinesWithSpinner` |
| Slot rendering | Via `SelectorRenderLine` (slot + slotMeta) | Manual `selectorViewModel.slots.map(...)` with custom JSX |
| Hint line | `↑↓ navigate ⏎ confirm (e)dit (r)efine (E)scalate \| (q)uit` | Only `clickConfirm: true`; no edit/refine/escalate hints |
| Confirm output | `✔ Generated N commit messages` + `✔ Selected: ...` + `✔ git commit -m "..."` | `✔ Candidate selected` (label doesn't exist in CLI) + custom layout |
| Capabilities | `edit: true, refine: true, escalate: true` | Only `clickConfirm: true` |

## Approach

1. Extract `RenderLine` / `SelectorFrame` from `marketing-control-loop-section.tsx` into a shared component
2. Replace the manual selector JSX in `terminal-tabs-demo.tsx` with the shared `SelectorFrame`
3. Align capabilities and copy with the CLI defaults

## Tasks

### Task 1: Extract shared `SelectorFrame` component

Extract `RenderLine` and `SelectorFrame` from `./packages/web/components/marketing-control-loop-section.tsx` into a shared component file (e.g., `./packages/web/components/selector-frame.tsx`).

Acceptance criteria:

- [x] `RenderLine` and `SelectorFrame` live in a shared file
- [x] `marketing-control-loop-section.tsx` imports from the shared file and works identically
- [ ] No visual regression

### Task 2: Replace manual selector rendering in terminal-tabs-demo

Replace the hand-built slot rendering in `./packages/web/components/terminal-tabs-demo.tsx` with `buildSelectorRenderLines` → `SelectorFrame`.

Remove the following demo-specific rendering helpers that are no longer needed:
- `renderSelectorLinesWithSpinner`
- `renderSlotLines`
- Manual `selectorViewModel.slots.map(...)` JSX block

Acceptance criteria:

- [x] Selector UI is rendered via `SelectorFrame` consuming `SelectorRenderLine[]`
- [x] Header, slots, slot meta, and hint lines all come from the shared abstraction
- [x] Interactive slots (hover/click) still work for candidate selection
- [x] Spinner animation during generation still works
- [x] `renderSelectorLinesWithSpinner` and `renderSlotLines` are removed

### Task 3: Align capabilities and copy with CLI

Update `selectorCapabilities` and `selectorCopy` in `terminal-tabs-demo.tsx` to match the CLI's defaults.

Acceptance criteria:

- [x] Capabilities include `edit: true, refine: true, escalate: true, clickConfirm: true`
- [x] Hint line renders the full action set: navigate, confirm, click confirm, edit, refine, escalate, quit
- [x] `selectorCopy` includes `itemLabelSingular`, `itemLabelPlural`, `selectionLabel` matching CLI defaults

### Task 4: Align confirm-phase output with CLI

Replace the confirm-phase rendering (`✔ Candidate selected` block) with output that mirrors the CLI's `renderFinalSelection`:

1. `✔ Generated N commit messages (total: $X.XXX)`
2. `✔ Selected: <message>`
3. `✔ git commit -m "..."` (or `jj describe -r @ -m "..."`)

Acceptance criteria:

- [x] Confirm output matches CLI's `renderFinalSelection` format
- [x] `✔ Candidate selected` label is removed
- [x] Cost display uses the header's `totalCostLabel` format (not per-candidate cost)
- [x] "Replay from start" button is preserved

## Verification

After each task:

```bash
bun --cwd packages/web typecheck
```

Visual verification in browser at the marketing page to confirm the demo terminal matches the real CLI output.

## Execution notes

- Extracted `RenderLine` and `SelectorFrame` into `./packages/web/components/selector-frame.tsx` and switched `marketing-control-loop-section.tsx` to import the shared renderer.
- Replaced the manual selector header/slot/hint rendering in `./packages/web/components/terminal-tabs-demo.tsx` with `buildSelectorRenderLines(...)` and the shared `SelectorFrame`.
- Aligned demo selector copy/capabilities with the CLI defaults while preserving tab-specific running labels.
- Rebuilt the selected phase to mirror the CLI flow: generated summary, selected summary, and a tab-specific final output line (`git commit -m ...`, `jj describe -r @ -m ...`, or raw translate output).
- Removed the old demo-only selector helpers and stopped accepting selector keyboard input after confirmation so the selected state stays static like the CLI.
- Adjusted Web success-line rendering so only the `✔` glyph uses the success color, matching the CLI's color placement for `Found ...` and post-confirm lines.
- Extended slot interactivity to the metadata line so hovering/clicking model/cost text changes the selected candidate just like hovering the title line.
- Updated the web hint copy to use the Unicode enter-key symbol for confirm and removed `click confirm` from the homepage demo hint while preserving click-to-confirm behavior.
- Normalized blank-line rendering to use a full text row instead of a custom short spacer so terminal rows stay visually equidistant while selecting and after confirmation.

## Validation results

- [x] `bun --cwd packages/web typecheck`
- [x] `bun --cwd packages/web test lib/util/terminal-selector-view-model.test.ts`
- [x] `mise run format`
- [ ] Browser verification on the marketing homepage
  Blocked in this environment:
  an unrelated app is already serving on `http://localhost:3000`, `mise run web:dev` for this repo fails because `packages/web/.next/dev/lock` is already held, and `bun --cwd packages/web build` fails under restricted network because `next/font` cannot fetch Google Fonts.

## Related files

- `./packages/web/components/terminal-tabs-demo.tsx` — Target demo component
- `./packages/web/components/marketing-control-loop-section.tsx` — Reference implementation using `SelectorRenderLine`
- `./packages/shared/terminal-selector-view-model.ts` — Shared ViewModel and `buildSelectorRenderLines`
- `./packages/web/lib/util/terminal-selector.ts` — Web-side selector utilities
- `./packages/cli/lib/renderer.ts` — CLI renderer (reference for output format)
- `./packages/cli/lib/selector.ts` — CLI selector (reference for `renderFinalSelection`)
