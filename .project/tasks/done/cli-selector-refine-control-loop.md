# [CLI] selector refine flow control via outer loop, keep existing UI

Owner: satoshi

Context:
- `selectCandidate` currently owns flow transitions and re-generation internally, while refine apply currently re-runs generation through the same existing candidate stream path.
- We want to keep terminal UI/interaction unchanged, and only switch orchestration at the command loop level.
- This enables easier API boundary swaps (e.g., new refine API) without redesigning selector rendering.

Acceptance criteria:
- [x] `selectCandidate` return contract for refine remains sufficient for outer-loop branching (`action: "refine"` is returned from shared flow + `selector.ts`).
- [x] Outer CLI command flow (`commit`/`translate`/`jj`) dispatches `refine` before launching candidate generation and restarts a fresh command execution context.
- [x] On `refine` action, selector session ends cleanly and next loop iteration starts generation with updated guidance.
- [x] Existing selector UI behavior is unchanged (`r` for refine, prompt text, keybindings, loading/selection rendering).
- [x] No regressions in edit/confirm/quit flows from unchanged selection UI.

Notes from verification:
- `commit`, `translate`, `jj describe` now rerun per-loop execution context and handle stale command execution promises by session-id guard to prevent old sessions from terminating the current TTY loop.
- `packages/cli/lib/selector.ts` resumes `ttyReader` on each `selectCandidate` invocation to avoid input not accepting after refine loop restarts.

Completion:
- Status: Done
- Verified manually: refine input no longer exits tty; candidate selection continues normally after `r` path on interactive flows.
