# Unify selector prompt rendering across CLI, Web, and Story

Owner: satoshi

## Motivation

The CLI's refine/edit prompt rendering diverged from the shared `SelectorPromptViewModel`. The CLI builds its prompt UI manually in `selector.ts` (slot list + inline input + placeholder + hint), while `renderPromptLines` in `renderer.ts` and the Web produce a different layout (`→ Refine mode` / `Target [N]:` / `Cost/Time:`). The `SelectorPromptViewModel` was originally designed to replicate the CLI's UI on the Web, so the shared model should follow the CLI — not the other way around.

### Current state

| Layer | Prompt rendering | Uses shared ViewModel? |
|-------|-----------------|----------------------|
| CLI `selector.ts` | Custom inline (slot list + `Refine:` input + placeholder + hint) | ❌ Bypasses it |
| CLI `renderer.ts` | `renderPromptLines` (different layout) | ✅ But CLI doesn't call it |
| Web | Own `renderPromptLines` copy (same different layout) | ✅ |
| Story | Temporary workaround matching CLI manually | ❌ |

### Goal

1. Update `SelectorPromptViewModel` to model the CLI's actual prompt layout
2. CLI uses the shared ViewModel for content, handles cursor control separately
3. Web and Story consume the same ViewModel and render correctly
4. CLI `renderer.ts`'s dead `renderPromptLines` is removed or replaced

## Approach

Separate "what to render" (ViewModel) from "where to put the cursor" (CLI-only):

- ViewModel accepts `bufferText: string` as input, produces the line content
- Edit mode: ViewModel changes selected slot's radio `●` → `>` and title → buffer text
- Refine mode: ViewModel appends `Refine:` + buffer text + placeholder + hint lines after slot list
- CLI reads rendered lines from ViewModel, then applies `readline.moveCursor` / `cursorTo` for cursor positioning
- Web/Story pass `bufferText: ""` and render without cursor control

## Tasks

Execute in order. After each task, verify CLI works correctly (`mise exec --raw -E sandbox -- bun packages/cli/index.ts jj describe -r @-`).

### Task 1: Extend `SelectorPromptViewModel` to model CLI's actual refine layout

Update `./packages/shared/terminal-selector-view-model.ts`:

- Add `bufferText?: string` to `BuildSelectorViewModelInput`
- Redesign `SelectorPromptViewModel` fields to represent: slot list (reused from list mode), `Refine:` prefix + buffer text, placeholder line, hint line
- Update `buildPromptViewModel` to produce the new structure
- Keep existing fields temporarily for backward compatibility if needed

Acceptance criteria:

- [ ] `SelectorPromptViewModel` can represent the CLI's actual refine prompt layout
- [ ] Existing tests pass (no breaking changes yet)

### Task 2: Extend `SelectorPromptViewModel` to model CLI's actual edit layout

Update the shared ViewModel for edit mode:

- Edit mode changes selected slot rendering: radio `●` → `>`, title → buffer text
- Hint line: `enter apply | esc back to select`

Acceptance criteria:

- [ ] `SelectorPromptViewModel` can represent the CLI's actual edit prompt layout
- [ ] Existing tests pass

### Task 3: Update CLI `renderer.ts` to render new prompt ViewModel

Replace `renderPromptLines` in `./packages/cli/lib/renderer.ts` with rendering logic that matches the new `SelectorPromptViewModel`.

Acceptance criteria:

- [ ] `renderSelectorTextFromRenderFrame` produces output matching current CLI prompt rendering
- [ ] Story renders correctly via the shared path (remove temporary workaround from `./packages/story/stories/selector.ts`)

### Task 4: Migrate CLI `selector.ts` to use shared ViewModel for prompt content

Replace the manual line-building in `openRefinePrompt` and `openEditPrompt` (`./packages/cli/lib/selector.ts`) with `selectorRenderFrame` + `renderSelectorTextFromRenderFrame`. Keep cursor control (`readline.moveCursor`, `cursorTo`) in the CLI.

Acceptance criteria:

- [ ] CLI refine prompt looks identical to current behavior
- [ ] CLI edit prompt looks identical to current behavior
- [ ] No duplicated rendering logic between `selector.ts` and `renderer.ts`

### Task 5: Update Web's prompt rendering

Replace `renderPromptLines` in `./packages/web/lib/util/terminal-selector.ts` with rendering that consumes the updated `SelectorPromptViewModel`.

Acceptance criteria:

- [ ] Web demo renders prompt mode matching CLI's layout
- [ ] No dead code remaining

## Verification

After each task:

```bash
mise exec --raw -E sandbox -- bun packages/cli/index.ts jj describe -r @-
# Enter refine mode (r), verify layout, esc
# Enter edit mode (e), verify layout, esc
# Confirm selection, verify commit
```

## Related files

- `./packages/shared/terminal-selector-view-model.ts` — ViewModel builder
- `./packages/shared/terminal-selector-contract.ts` — State types
- `./packages/cli/lib/renderer.ts` — CLI ANSI renderer
- `./packages/cli/lib/selector.ts` — CLI selector with manual prompt rendering
- `./packages/web/lib/util/terminal-selector.ts` — Web renderer
- `./packages/story/stories/selector.ts` — Story definitions
