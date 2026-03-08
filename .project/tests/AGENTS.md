# tests Directory

## Purpose

- Store reusable verification scenarios that a human or agent can execute.
- Separate:
  - scenario definitions in `scenarios/`
  - reusable templates in `templates/`
  - execution outputs in `reports/`

## Directory roles

- `scenarios/`
  - Canonical test scenarios grouped by what is being tested, not by how they are executed
- `templates/`
  - Canonical markdown templates for new scenarios and reports
- `reports/`
  - Time-stamped execution results for scenarios

## Authoring rules

- A scenario file describes **what to verify and how to verify it**.
- A report file describes **what happened in one concrete execution**.
- Keep one scenario focused on one behavior or one narrow user flow.
- Prefer small, composable scenarios over large end-to-end scripts.
- Write all scenario files in English unless there is a strong reason not to.
- File/document links in scenario and report files MUST use repository-root-relative paths.
- Do not use top-level directory names to express execution method such as `browser`, `cli`, or `hybrid`.
- Execution method should be written inside the scenario file as metadata.
- When a user asks to test a specific scenario under `./.project/tests/scenarios/`, use [$test-scenario-runner](../../.agents/skills/test-scenario-runner/SKILL.md).

## Required scenario structure

Every scenario file should contain these sections:

- `Purpose`
- `Scope`
- `Method`
- `Preconditions`
- `Steps`
- `Expected`
- `Evidence`
- `Pass Criteria`

## Required report structure

Every report file should contain these sections:

- `Scenario`
- `Date`
- `Environment`
- `Result`
- `Observations`
- `Evidence`
- `Failures` or `Blocked` when applicable

## Writing expectations

- Avoid vague statements such as `works`, `looks good`, or `seems fine`.
- Prefer observable assertions:
  - URL changed to a specific path
  - specific text is visible
  - a button exists or is disabled
  - a command exits with a specific message
- If a scenario depends on OAuth, payments, email, or external services, call out the manual handoff points explicitly.
- If a scenario needs a disposable or test email address, prefer AgentMail rather than personal, shared, or hard-coded inboxes.
- Email-dependent scenarios should state whether the runner is expected to create an AgentMail inbox, wait for a message, inspect message contents, or follow a link from the received message.
- If a scenario is intended for `agent-browser`, make the expected page transitions and visible markers explicit.
- Use `Scope` to describe the feature area under test, for example:
  - `auth`
  - `billing`
  - `cli`
  - `checkout`
  - `onboarding`
- Use `Method` to describe how the scenario is executed, for example:
  - `browser`
  - `cli`
  - `hybrid`

## Reports policy

- Reports are append-only historical artifacts.
- Multiple reports for the same scenario are expected.
- Recommended layout:
  - `reports/YYYY-MM-DD/<scenario-slug>.md`
- Keep reports concise. Do not copy the full scenario into the report.
- Link each report back to its scenario file.

## Local sandbox convention

- The local sandbox web environment can be started with:
  - `bun --cwd packages/web dev`
- The web app uses `portless`, so the local URL is not fixed.
- Use the `Local:` URL printed by the dev server output.
  - example: `http://localhost:4977`
- The `PORTLESS_URL` value and `web.localhost` proxy URL may also be shown, but browser-based test scenarios should use the printed `Local:` URL unless the scenario says otherwise.
- Scenario files should override these defaults when they require a different environment.

## Recommended workflow

1. Put the high-level QA objective in `./.project/tasks/`.
2. Put concrete executable scenarios in `./.project/tests/`.
3. Execute the scenario manually or with an agent.
4. Save the result in `./.project/tests/reports/YYYY-MM-DD/`.
5. Update the task with the outcome and move it if status changes.

## Agent execution guidance

- For scenario execution requests, start by loading [$test-scenario-runner](../../.agents/skills/test-scenario-runner/SKILL.md).
- If the scenario requires email setup or message inspection, also load [$agentmail-cli](../../.agents/skills/agentmail-cli/SKILL.md).
- Use `agent-browser` when the scenario `Method` is `browser`.
- Use terminal commands when the scenario `Method` is `cli`.
- Use both when the scenario `Method` is `hybrid`.
- Use AgentMail-managed inboxes for email steps unless the scenario explicitly requires a different mailbox.
- Stop at the first meaningful failure and record:
  - the exact step
  - the observed behavior
  - the expected behavior
  - any useful screenshot or terminal output

## Naming rules

- Use short stable slugs:
  - `anonymous-first-run.md`
  - `signup-redirects-to-checkout.md`
  - `unpaid-user-blocked-after-login.md`
- Report file names should usually match the scenario slug.
- If scenario volume grows, create subdirectories under `scenarios/` by feature area, for example:
  - `scenarios/auth/`
  - `scenarios/checkout/`
  - `scenarios/cli/`
  rather than by execution method.

## When adding or renaming files

If you add or rename top-level directories under `tests/`, also update [../AGENTS.md](../AGENTS.md).
