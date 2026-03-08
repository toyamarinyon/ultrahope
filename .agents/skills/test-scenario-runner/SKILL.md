---
name: test-scenario-runner
description: Execute a test scenario from .project/tests/scenarios, follow its Preconditions/Steps/Expected/Evidence/Pass Criteria, use agent-browser for browser steps, and write a report under .project/tests/reports. Use when the user asks to test or verify a specific scenario file such as ".project/tests/scenarios/...md テストして".
---

# Test Scenario Runner

Use this skill when the user asks to execute a scenario under `./.project/tests/scenarios/`.

## Required workflow

1. Read `./.project/tests/AGENTS.md`.
2. Read the requested scenario file.
3. Treat the scenario file as the source of truth.
4. Extract:
   - `Scope`
   - `Method`
   - `Preconditions`
   - `Steps`
   - `Expected`
   - `Evidence`
   - `Pass Criteria`
5. Execute only the requested scenario unless the user explicitly asks for a batch.
6. Stop at the first meaningful failure and record:
   - exact failed step
   - expected behavior
   - observed behavior
   - supporting output or screenshot
7. Write a report to `./.project/tests/reports/YYYY-MM-DD/<scenario-slug>.md` using the report template.

## Execution method

- If `Method` is `browser`, use [$agent-browser](../agent-browser/SKILL.md).
- If `Method` is `cli`, use shell commands and capture terminal output.
- If `Method` is `hybrid`, use both browser and terminal tools.
- If the scenario needs an email address, inbox, or email verification step, use [$agentmail-cli](../agentmail-cli/SKILL.md) instead of a personal or hard-coded email address.
- If `AGENTMAIL_API_KEY` is missing for an email-dependent scenario, say exactly what is missing and stop.

## Environment conventions

- If the scenario targets the local sandbox web app, use:
  - command: `bun --cwd packages/web dev`
  - URL: use the `Local:` URL printed by the dev server output
- The local web app uses `portless`, so do not assume a fixed port.
- Prefer the printed `Local:` URL, for example `http://localhost:4977`.
- Prefer using the environment and URL stated in the scenario file over defaults.
- If a prerequisite is missing, say exactly what is missing and stop instead of guessing.

## Reporting rules

- Use the report template at `./.project/tests/templates/report-template.md`.
- Keep reports concise.
- Do not copy the full scenario into the report.
- Include enough evidence that another engineer can understand the result quickly.
- When AgentMail is used, include the generated inbox address in `Evidence` when it helps reproduce or inspect the flow.

## Scope boundary

- Do not expand the scenario with extra checks unless needed to resolve ambiguity in the documented steps.
- If the scenario reveals a product bug and there is an obvious related task, mention it in the final summary.
