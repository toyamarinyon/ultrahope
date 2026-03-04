# CLI Story Viewer — TUI Storybook for terminal rendering

Owner: satoshi

## Motivation

The CLI uses a custom, dependency-free rendering library (`renderer.ts`) that produces ANSI-styled terminal output. Currently there is no way to visually inspect or browse the various UI states without running the full CLI flow end-to-end. A Storybook-like TUI viewer would allow developers to:

- Browse all visual states of CLI components in isolation
- Catch rendering regressions quickly
- Onboard to the CLI rendering codebase via concrete visual examples

## Usage

```bash
bun --cwd packages/story main.ts
```

Launches an interactive TUI that displays a navigable catalog of CLI rendering stories.

## Output image

```
┌─ Stories ──────────────────┬─ Preview ──────────────────────────────┐
│ ▼ Selector                 │                                        │
│   ● generating 2/4         │  ⠋ Generating commit messages...  2/4  │
│   ○ all ready              │                                        │
│   ○ 2nd selected           │    ● feat: add login page              │
│   ○ with cost              │      gpt-4o $0.003 1.2s               │
│   ○ error slot             │    ○ Generating...                     │
│   ○ prompt refine          │    ○ Generating...                     │
│   ○ prompt edit            │                                        │
│ ▶ UI Primitives            │    ↑↓ navigate | (e)dit | (q)uit      │
│ ▶ Line Editor              │                                        │
│                            │                                        │
└────────────────────────────┴────────────────────────────────────────┘
  ↑↓ select  ←→ collapse/expand  q quit
```

## Key design decisions

### 1. New package: `packages/story`

The story viewer is not part of the CLI runtime. It lives in a separate package to avoid bundling story definitions and the TUI viewer shell into the published CLI.

```
packages/story/
  main.ts              -- Entry point
  viewer.ts            -- TUI shell (split layout, key handling, rendering)
  stories/
    index.ts           -- Exports all StoryGroup[]
    selector.ts        -- Selector UI stories
    ui-primitives.ts   -- (future) ui.success, ui.progress, etc.
```

### 2. Story definition interface

```ts
interface Story {
  name: string;
  render: (columns: number) => string;    // Returns ANSI string for fixed display
  animate?: (tick: number, columns: number) => string;  // Future: animated stories
}

interface StoryGroup {
  name: string;
  stories: Story[];
}
```

- `render()` is a **pure function** that returns an ANSI string. The viewer never calls `process.stdout.write` on behalf of a story — it places the returned string into the right column.
- `animate()` is optional. When present and the viewer supports animation, it calls this with an incrementing `tick` via `setInterval` to produce frames (e.g., spinner rotation).

### 3. Selector stories leverage existing architecture

The CLI rendering is already cleanly separated:

| Layer | File | Role |
|-------|------|------|
| State machine | `./packages/shared/terminal-selector-flow.ts` | Pure state transitions |
| ViewModel | `./packages/shared/terminal-selector-view-model.ts` | `state → SelectorRenderFrame` |
| ANSI renderer | `./packages/cli/lib/renderer.ts` | `frame → ANSI string` |

Each selector story defines a `BuildSelectorViewModelInput`, then pipes it through:

```
input → selectorRenderFrame(input) → renderSelectorTextFromRenderFrame(frame) → ANSI string
```

No mocking or TTY simulation is needed.

### 4. TUI viewer is independent from story content

The viewer (`viewer.ts`) manages:

- **Left column**: Tree navigation with collapsible groups (↑↓ to move, ←→ to collapse/expand, Enter to select)
- **Right column**: Renders the selected story's `render()` output verbatim
- **q** to quit

The viewer has **zero knowledge** of what a story renders. It simply calls `story.render(availableColumns)` and writes the result into the right pane. This means any future component type (line editor, error screens, etc.) can be added without touching viewer code.

### 5. Spinner / animation support

Initial implementation uses fixed frames only (`render()`). Animation-ready design:

- When a story has `animate`, the viewer starts a `setInterval` (e.g., 80ms) that increments a tick counter and re-renders the right pane with `story.animate(tick, columns)`.
- For selector stories with `isGenerating: true`, animation simply updates `nowMs` — the existing `selectorRenderFrame` computes the spinner frame from `Math.floor(nowMs / 80) % spinnerFrames.length`.
- When navigating away from an animated story, the interval is cleared.

## Scope and phasing

### Phase 1 (this task)

- [ ] Create `packages/story` package with `main.ts` entry point
- [ ] Implement `viewer.ts` — split-pane TUI shell with tree navigation
- [ ] Define `Story` and `StoryGroup` interfaces
- [ ] Implement selector stories covering key states:
  - Generating in progress (e.g., 2/4 ready)
  - All candidates ready, first selected
  - All candidates ready, non-first selected
  - With cost and generation time metadata
  - Slot with error
  - Prompt mode: refine
  - Prompt mode: edit
- [ ] Run with `bun --cwd packages/story main.ts`

### Phase 2 (future)

- [ ] UI primitive stories (`ui.success`, `ui.progress`, `ui.bullet`, `ui.hint`, etc.)
- [ ] Animation support for spinner stories
- [ ] Line editor stories
- [ ] mise task shortcut (e.g., `mise run story`)

## Related links

- `./packages/cli/lib/renderer.ts` — ANSI rendering engine and `renderSelectorTextFromRenderFrame`
- `./packages/cli/lib/ui.ts` — UI primitives (success, progress, bullet, etc.)
- `./packages/cli/lib/theme.ts` — ANSI color theme
- `./packages/shared/terminal-selector-view-model.ts` — ViewModel builder and `selectorRenderFrame`
- `./packages/shared/terminal-selector-contract.ts` — State types and interfaces
- `./packages/shared/terminal-selector-flow.ts` — State machine transitions

## Next action

- Implement Phase 1: create `packages/story` package, viewer shell, and initial selector stories.
