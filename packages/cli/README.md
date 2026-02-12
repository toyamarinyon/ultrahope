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
