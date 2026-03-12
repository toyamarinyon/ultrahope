# [CLI] Add `jj commit` support to Ultrahope Jujutsu integration

Owner: satoshi

Context:
- `./packages/cli/commands/jj.ts` currently supports `ultrahope jj describe`, but not `ultrahope jj commit`.
- In Jujutsu, `jj commit` is close to `jj describe` followed by creating a new working-copy change on top, so the existing message-generation UX should be reusable with a different final apply step.
- The safest implementation is a minimal extension: reuse the interactive candidate selection/refine flow from `describe`, keep scope to the default `jj commit -m <message>` behavior, and avoid taking on fileset / `--interactive` parity in the first pass.
- Documentation also needs to change so users understand when to use `describe` versus `commit`, and what behavior difference to expect.

Acceptance criteria:
- [ ] `ultrahope jj commit` is recognized as a valid subcommand in `./packages/cli/commands/jj.ts`.
- [ ] The command reuses the existing commit-message generation UX (candidate generation, refine, escalation, quota handling, stream capture) instead of introducing a separate interaction model.
- [ ] The generated message is applied with `jj commit -m <message>` against the working-copy commit (`@`), without introducing unsupported `-r` behavior.
- [ ] Shared logic between `jj describe` and `jj commit` is factored so the two commands do not drift in behavior or error handling.
- [ ] `ultrahope jj --help` documents both `describe` and `commit`, including the behavioral difference between them.
- [ ] `./packages/cli/README.md` is updated to mention `ultrahope jj commit`, `--guide` support for it if applicable, and the intended difference from `ultrahope jj describe`.
- [ ] `./packages/web/app/docs/docs.md` is updated anywhere the public docs describe Jujutsu usage so `jj commit` support and the difference from `jj describe` are reflected consistently.
- [ ] Run `mise run format` after the changes and fix any issues until it passes.

Related links:
- `./packages/cli/commands/jj.ts`
- `./packages/cli/README.md`
- `./packages/web/app/docs/docs.md`
- `./packages/cli/index.ts`
- `./opensrc/repos/github.com/jj-vcs/jj/cli/tests/cli-reference@.md.snap`

Next action:
- Extract the reusable message-generation/apply flow in `jj.ts`, then add a `commit` branch that uses `jj diff -r @ --git` for generation and `jj commit -m` for apply, followed by help/README updates.
