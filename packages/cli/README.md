# ultrahope

LLM-powered development workflow assistant CLI.

## Installation

```bash
npm install -g ultrahope
```

## Usage

### Login

Authenticate with your ultrahope account using device flow:

```bash
ultrahope login
```

This will display a URL and code. Open the URL in your browser, sign in, and enter the code to authorize the CLI.
On first successful login, `${XDG_CONFIG_HOME:-~/.config}/ultrahope/config.toml` is created automatically if missing.

### Translate

Translate input to various formats. Pipe content to the command:

```bash
# Generate a commit message from git diff
git diff --staged | ultrahope translate --target vcs-commit-message

# Generate PR title and body from diff
git diff main | ultrahope translate --target pr-title-body

# Analyze PR intent
git diff main | ultrahope translate --target pr-intent

# Override models for this run
git diff --staged | ultrahope translate --target vcs-commit-message --models mistral/ministral-3b,xai/grok-code-fast-1
```

### Guide context for commit/message generation

In `git ultrahope commit` and `ultrahope jj describe`, you can use `--guide <text>` to provide intent that is not obvious from the diff alone.

```bash
# Additional guidance for git commit generation
git add -A && git ultrahope commit --guide "GHSA-gq3j-xvxp-8hrf: override reason"

# Additional guidance for jj describe generation
jj ultrahope describe --guide "GHSA-gq3j-xvxp-8hrf: override reason"
```

If you run `git ultrahope commit` with no staged files, it exits immediately:

```bash
# Without staged changes:
git ultrahope commit
Error: No staged changes. Stage files with `git add` first.
```
If no files are staged, the command exits immediately and requires `git add` to stage changes first.

In interactive mode for `git ultrahope commit`, `ultrahope jj describe`, and `ultrahope translate --target vcs-commit-message`, use `r` to refine the generated results with additional instructions.

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

Credentials are stored in `~/.config/ultrahope/credentials.json`.

## Development

```bash
# Build
pnpm run build

# Link for local testing
pnpm link --global
```
