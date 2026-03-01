# [CLI] selector refine flow control via outer loop, keep existing UI

Owner: satoshi

Context:
- `selectCandidate` currently owns flow transitions and re-generation internally, while refine apply currently re-runs generation through the same existing candidate stream path.
- We want to keep terminal UI/interaction unchanged, and only switch orchestration at the command loop level.
- This enables easier API boundary swaps (e.g., new refine API) without redesigning selector rendering.

Acceptance criteria:
- [ ] `selectCandidate` return contract for refine remains sufficient for outer-loop branching (or equivalent explicit result handling).
- [ ] Outer CLI command flow (interactive loops in `commit`/`translate`/`jj` if applicable) decides next action before launching candidate generation.
- [ ] On `refine` action, the current selector session is ended and a fresh loop/command execution context is prepared.
- [ ] Existing selector UI behavior is unchanged (`r` for refine, prompt text, keybindings, loading/selection rendering).
- [ ] No regressions in edit/confirm/quit flows from unchanged selection UI.

Next action:
- Implement the loop-level action dispatch and document the exact branch for `refine` (new execution context + candidates factory rebuild).
