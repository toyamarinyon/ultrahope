# Scenario: Anonymous CLI first run

## Purpose

Verify that a brand new CLI session can use Ultrahope without login and that local anonymous credentials are created correctly.

## Scope

- `auth`
- `cli`

## Method

- `cli`

## Preconditions

- App URL: target deployment URL for the current environment
- Environment: local or sandbox
- Auth state: logged out
- Account state: no account required
- Required fixtures:
  - a staged git diff or equivalent input for commit-message generation
- Required env vars or flags:
  - if using sandbox, set `ULTRAHOPE_ENV=sandbox`
  - ensure `SKIP_DAILY_LIMIT_CHECK` is not relevant to this scenario

## Steps

1. Remove the local Ultrahope credentials file for the target environment.
2. Prepare a small staged diff.
3. Run `ultrahope translate --target vcs-commit-message` with the staged diff piped into stdin.
4. Inspect the credentials file created by the command.

## Expected

- The command succeeds without requiring `ultrahope login`.
- A credentials file is created.
- The credentials file contains:
  - `auth_kind: "anonymous"`
  - a non-empty `access_token`
  - a non-empty `installation_id`

## Evidence

- Final terminal output from the successful command
- Contents of the created credentials file
- Environment used for the run

## Pass Criteria

- Anonymous usage is available on first run without a prior account flow.
- Local credentials are created with the expected anonymous shape.

## Notes

- This scenario only verifies first-run anonymous bootstrap.
- Daily limit behavior belongs in a separate scenario.
