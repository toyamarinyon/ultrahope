# Halo

LLM-powered development workflow assistant CLI.

## Installation

```bash
npm install -g @ultrahope/halo
```

## Usage

### Login

You can try Halo without logging in first. The CLI automatically creates an anonymous session and allows up to 5 requests per day with the Free plan limits.

When you want to keep going, authenticate with your Halo account using device flow:

```bash
halo login
```

This will display a URL and code. Open the URL in your browser, sign in, and enter the code to authorize the CLI. On successful login, the CLI replaces the anonymous session with your authenticated one while keeping the local installation identity.

Escalation (`Shift+E`) uses the Pro model set (`anthropic/claude-sonnet-4.6`,
`openai/gpt-5.3-codex`). If your account is not Pro, escalation is not shown and
requesting Pro-only models is rejected by the API.

### Translate

Translate input to various formats. Pipe content to the command:

```bash
# Generate a commit message from git diff
git diff --staged | halo translate --target vcs-commit-message

# Generate PR title and body from diff
git diff main | halo translate --target pr-title-body

# Analyze PR intent
git diff main | halo translate --target pr-intent

# Override models for this run
git diff --staged | halo translate --target vcs-commit-message --models mistral/ministral-3b,xai/grok-code-fast-1
```

### Guide context for commit/message generation

In `git halo commit`, `halo jj commit`, and `halo jj describe`, you can use `--guide <text>` to provide intent that is not obvious from the diff alone.

```bash
# Additional guidance for git commit generation
git add -A && git halo commit --guide "GHSA-gq3j-xvxp-8hrf: override reason"

# Additional guidance for jj describe generation
jj halo describe --guide "GHSA-gq3j-xvxp-8hrf: override reason"

# Additional guidance for jj commit generation
jj halo commit --guide "GHSA-gq3j-xvxp-8hrf: override reason"
```

If you run `git halo commit` with no staged files, it exits immediately:

```bash
# Without staged changes:
git halo commit
Error: No staged changes. Stage files with `git add` first.
```
If no files are staged, the command exits immediately and requires `git add` to stage changes first.

In interactive mode for `git halo commit`, `halo jj describe`, `halo jj commit`, and `halo translate --target vcs-commit-message`, use `r` to refine the generated results with additional instructions.

In Jujutsu:
- `halo jj describe` updates an existing revision message.
- `halo jj commit` creates a new working-copy commit using the generated message.

#### Difference Between `guide` And Refine Instructions

- `--guide`:
  - Supplemental intent outside the diff (for example: ticket ID, background, change intent)
- `r refine`:
  - Review generated results and enter inline instructions for the next refinement pass
  - Examples: "more formal", "shorter"
  - Press `Enter` with empty input to clear the previous refine instructions
  - If specified multiple times, the last one overwrites previous values
- `r` applies refinement instructions (`refine`)
- At request time, refine instructions are merged into `guide` and sent to the API:
  - `--guide` only: `guide = "<guide>"`
  - `r refine` only: `guide = "<refine>"`
  - both: `guide = "<guide>\n\nRefinement: <refine>"`

#### Targets

- `vcs-commit-message` - Generate a commit message
- `pr-title-body` - Generate PR title and body
- `pr-intent` - Analyze the intent of changes

## Configuration

### Environment Variables

- `ULTRAHOPE_API_URL` - API endpoint (default: `https://ultrahope.dev`)

### Models Configuration

Models are resolved in this order (highest priority first):

1. CLI flag: `--models <model1,model2,...>`
2. Project config: nearest `.ultrahope.toml` or `ultrahope.toml` in current/parent directories
3. Global config: `${XDG_CONFIG_HOME:-~/.config}/ultrahope/config.toml`
4. Built-in defaults

Example config:

```toml
models = ["mistral/ministral-3b", "xai/grok-code-fast-1"]
```

### Credentials

Credentials and the local installation ID are stored in `~/.config/ultrahope/credentials.json`.

### Migration compatibility

Halo is the primary name, but compatibility commands continue to work:
`ultrahope`, `git ultrahope`, `git hope`, and `git uh`.

Config and credentials stay on the legacy Ultrahope paths for now:
- project: `.ultrahope.toml` or `ultrahope.toml`
- global config: `~/.config/ultrahope/config.toml`
- credentials: `~/.config/ultrahope/credentials.json`

Environment variable compatibility is unchanged:
- `ULTRAHOPE_API_URL`

## Development

```bash
# Build
pnpm run build

# Link for local testing
pnpm link --global
```
