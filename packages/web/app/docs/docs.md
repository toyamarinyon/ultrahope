# Halo CLI Documentation

Halo generates commit message candidates from your diff — right in the terminal.
You compare, edit, or escalate. You have the final word.

## Quickstart

Install once, use from any repo.

```shell
npm install -g @ultrahope/halo
```

Stage your changes and run:

```shell
git add -p
git halo commit
```

That's it. Works immediately — no account needed.

The free tier gives you 5 requests per day. If you need more, [see pricing](/pricing).

## Git

### commit

Generate commit messages from staged changes:

```shell
git halo commit
```

Halo reads your `git diff --cached`, sends it to the configured models, and presents multiple candidates in an interactive selector.

#### --guide

Provide additional context to steer the generated messages:

```shell
git halo commit --guide "security fix for CVE-2024-1234"
```

The guide text is passed alongside your diff so the model can produce more relevant messages. Maximum 1024 characters.

### Aliases

The CLI registers compatibility names you can use instead of `git halo`:

- `git ultrahope commit`
- `git hope commit`
- `git uh commit`

They behave identically.

## Jujutsu

Halo supports [Jujutsu](https://jj-vcs.github.io/jj/) as a first-class VCS.

### Setup

Register `halo` as a jj alias:

```shell
halo jj setup
```

This runs `jj config set --user aliases.halo '["util", "exec", "--", "halo", "jj"]'` so you can call it as a jj subcommand. It also keeps/sets `aliases.ultrahope` for compatibility.

### describe

Generate commit descriptions from revision changes:

```shell
jj halo describe
```

By default it operates on the working-copy revision (`@`). Use `-r` to target a different revision:

```shell
jj halo describe -r @-
```

The `--guide` flag works the same as in `git halo commit`.

### commit

Generate and apply a commit message as a new working-copy commit:

```shell
jj halo commit
```

By default it operates on the working copy (`@`) and runs `jj commit -m <message>`.

The `--guide` flag works the same as in `git halo commit` and `jj halo describe`.

### Behavioral difference

- `jj halo describe` updates the target revision metadata (message) and does not create a new commit.
- `jj halo commit` always creates a new working-copy change with the generated message.

## Translate

Pipe arbitrary text into `halo translate` to generate structured output:

```shell
git diff HEAD~3..HEAD | halo translate --target pr-title-body
```

Available targets:

| Target | Output |
|--------|--------|
| `vcs-commit-message` | Commit message from a diff |
| `pr-title-body` | Pull request title and body |
| `pr-intent` | One-line intent summary |

## Interactive UI

When candidates are ready, Halo presents an interactive selector:

| Key | Action |
|-----|--------|
| `↑` `↓` | Navigate between candidates |
| `Enter` | Accept the selected candidate |
| `e` | Edit the selected candidate inline |
| `r` | Refine — provide a hint and regenerate |
| `Shift+E` | Escalate to a stronger model |
| `q` | Quit (or go back to initial candidates after refine) |

### Escalation

Press `Shift+E` during selection to re-generate using the `pro` tier escalation models. This is useful when the `default` tier models produce unsatisfying results and you want a stronger second pass.

`Shift+E` is available only to users with a Pro entitlement. For anonymous users and
authenticated users who are not currently subscribed to Pro, the option is hidden because Pro-tier model usage requires the Pro plan.

## Configuration

Halo reads configuration from TOML files. No configuration is required — sensible defaults are provided.

### Resolution order

Settings are resolved in this order (first match wins):

1. CLI flags (`--models`)
2. Project config (`.ultrahope.toml` or `ultrahope.toml` in the repo root, searched upward)
3. Global config (`~/.config/ultrahope/config.toml`)
4. Built-in defaults

### Config file format

```toml
# ~/.config/ultrahope/config.toml

# Models to use for generation (each model produces one candidate)
models = ["mistral/ministral-3b", "xai/grok-code-fast-1"]

# Models to use when pressing Shift+E to escalate to the pro tier
escalation_models = ["anthropic/claude-sonnet-4.6", "openai/gpt-5.3-codex"]
```

Place an `.ultrahope.toml` in your repository root to set project-specific models.

### Rename compatibility

Halo is now the primary CLI product name and command path.

During migration, these compatibility commands remain supported:
- `ultrahope`
- `git ultrahope`
- `git hope`
- `git uh`

Config and auth file paths intentionally keep the legacy namespace in this pass:
- `.ultrahope.toml` / `ultrahope.toml`
- `~/.config/ultrahope/config.toml`
- `~/.config/ultrahope/credentials.json`

Environment variable compatibility is unchanged:
- `ULTRAHOPE_API_URL`

### Models

See the [models page](/models) for the full list of available models and providers,
including which models are Pro-only.

### CLI flags

Override models for a single invocation:

Escalation models are configured in `escalation_models` in your config file and are
typically `pro` tier models.

Use this flag to override defaults for a single command:


```shell
git halo commit --models "anthropic/claude-sonnet-4.6,openai/gpt-5.3-codex"
```

Running this command without Pro will still start, but `pro` tier models will be rejected
at generation time if selected.

## Authentication

### Anonymous (Free tier)

The CLI works without an account. On first use, an anonymous session is created automatically and stored locally.

- 5 requests per day
- 40,000 character input limit per request
- Resets daily

This is not a trial. It is a permanent free tier with these limits.

### Login

To remove limits, create an account and authenticate:

```shell
halo login
```

This opens a browser-based device code flow. Once authorized, the token is saved and used for all subsequent requests.

### Credentials

Credentials are stored at:

```
~/.config/ultrahope/credentials.json
```

The file contains your access token and installation ID. It is created automatically.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ULTRAHOPE_API_URL` | Override the API endpoint (default: `https://ultrahope.dev`) |
| `ULTRAHOPE_ENV` | Environment name; affects credential file naming |

## Pricing

| Plan | Price | Limits |
|------|-------|--------|
| Free | $0 | 5 requests/day, no account needed |
| Pro | $3/month | Unlimited requests, $1 included credit/month |

Pro overage is billed at actual model cost. See [pricing](/pricing) for current details.

## License

The CLI (`packages/cli`) is [MIT](https://github.com/toyamarinyon/ultrahope/blob/main/LICENSE) licensed.
The web application (`packages/web`) is [AGPL-3.0](https://github.com/toyamarinyon/ultrahope/blob/main/packages/web/LICENSE) licensed.

Source code: [github.com/toyamarinyon/ultrahope](https://github.com/toyamarinyon/ultrahope)
