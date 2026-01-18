# Environment-Separated Task Execution

This project uses mise config environments and task wrappers to make it explicit
which environment (sandbox or production) a task runs against.

## How environment configs are selected

- Base config: `mise.toml` or `.mise.toml`
- Env-specific config: `mise.<env>.toml` or `.mise.<env>.toml`
- Select with `MISE_ENV=<env>` or `mise -E <env> ...`

Example:

```sh
MISE_ENV=sandbox mise run web
mise -E production run web
```

## Important constraint

`MISE_ENV` is resolved before mise loads config files, so a task cannot switch
its own config environment. To force an environment, wrap the task and call
`mise -E <env> run <task>`.

## Current pattern in this repo

`mise.toml` defines a base task and a sandbox wrapper:

```toml
[tasks."dev:web"]
description = "Start web dev server"
run = "bun run --cwd packages/web dev"

[tasks.web]
description = "Start web dev server (sandbox env)"
run = "mise -E sandbox run dev:web"
```

## Pattern for new scripts in `scripts/`

When you add a script to `scripts/`, define a base task and an env wrapper.
This makes it easy to say "run this script in sandbox via mise."

```toml
[tasks."script:example"]
description = "Run scripts/example.sh"
run = "bash scripts/example.sh"

[tasks."sandbox:example"]
description = "Run scripts/example.sh in sandbox"
run = "mise -E sandbox run script:example"

[tasks."production:example"]
description = "Run scripts/example.sh in production"
run = "mise -E production run script:example"
```

Run them like:

```sh
mise run sandbox:example
mise run production:example
```
