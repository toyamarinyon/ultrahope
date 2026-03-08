# AGENTS.md — Ultrahope

Ultrahope is an LLM-powered development workflow assistant. It consists of a **CLI** published to npm and a **Web** application (Next.js) that provides the API backend, billing, and marketing site.

## Why Ultrahope exists

Coding Agents are amazing, but I do not believe the entire development flow should be completed within a single agent.
I also want to combine multiple Coding Agents, and I do not like strongly depending on the features of one specific agent.
I like Unix commands. Even now I build my development flow by combining Unix‑friendly tools like git, gh, jujutsu, and fzf.
I wanted to insert the power of LLMs into that flow.

## Monorepo structure

| Package | Description |
|---------|-------------|
| `packages/cli` | CLI tool (`ultrahope` / `git-hope`). Published to npm. |
| `packages/web` | Next.js app — API (Elysia), auth (Better Auth), billing (Polar), DB (Turso/Drizzle). |
| `packages/shared` | Shared utilities used by both CLI and Web. |
| `packages/commit-message-benchmark` | Internal benchmark suite for commit message generation quality. |
| `scripts/` | Operational scripts (DB fork, Polar sync, user management). |

Each package has its own `AGENTS.md` with package-specific guidance.

## Project management — `.project/`

The `.project/` directory holds tasks, decisions, and reference docs. See [.project/AGENTS.md](.project/AGENTS.md) for the full layout.

- `tasks/` — Task board (`active/`, `backlog/`, `blocked/`, `done/`)
- `tests/` — Scenario-based manual/agent test definitions and execution reports
- `decisions/` — ADR-style decision records
- `docs/` — External documentation references (Polar, Next.js, etc.)

### Test scenario requests

If the user asks to execute or verify a specific scenario file under `./.project/tests/scenarios/`, use the [`test-scenario-runner`](./.agents/skills/test-scenario-runner/SKILL.md) skill first.

Examples:

- `./.project/tests/scenarios/auth/anonymous-cli-first-run.md テストして`
- `[anonymous-cli-first-run.md](.project/tests/scenarios/auth/anonymous-cli-first-run.md) test this`

For these requests:

- treat the scenario file as the source of truth
- follow `./.project/tests/AGENTS.md`
- write a report under `./.project/tests/reports/YYYY-MM-DD/`

## File Change Workflow

After creating or modifying files, run `mise run format` and resolve any reported issues until the check passes cleanly.

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->

## Environment Variables for Scripts

When running scripts that require access tokens or API keys, use `mise -E amp env` to load environment variables:

```bash
eval "$(mise -E amp env)" && <your-command>
```

If authentication or authorization fails due to missing values, please notify the user.
