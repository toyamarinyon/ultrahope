# [CLI] Use refine API on refine path (minimal changes outside API execution)

Owner: satoshi

Context:
- Once refine API is available, refine apply should call it, while keeping other generation logic (slot processing, streaming candidate rendering, selection behavior) untouched.
- API response format is expected to match existing flow (like translate/commit generation path), so only generation-call wiring should change.
- `startCommandExecution` should be reissued for refine if design requires fresh command execution session per refine attempt.

Acceptance criteria:
- [ ] When `selectCandidate` returns `refine`, CLI routes to call refine generation endpoint instead of standard commit-message generation.
- [ ] Keep selector rendering untouched; only generator wiring and command-execution lifecycle change.
- [ ] Preserve existing candidate adapter (`generateCommitMessages`/`createCandidates`) pattern with minimal refactor.
- [ ] Ensure refine uses the selected message + refine input from prompt as request payload.
- [ ] Preserve error handling semantics (`InvalidModelError`, `commandExecution` abort, quota/billing errors) equivalent to current flow.
- [ ] Maintain streaming/capture behavior and edited-selection behavior when user confirms refined result.
- [ ] Add smoke/behavior tests if existing selector/CLI tests exist for refine path.

Related links:
- `./packages/cli/commands/commit.ts`
- `./packages/cli/commands/translate.ts`
- `./packages/cli/commands/jj.ts`
- `./packages/cli/lib/vcs-message-generator.ts`
- `./packages/cli/lib/selector.ts`

Next action:
- Implement per-command branching from refine result and point candidate generation at refine endpoint while keeping output rendering unchanged.
