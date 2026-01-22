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

### Translate

Translate input to various formats. Pipe content to the command:

```bash
# Generate a commit message from git diff
git diff --staged | ultrahope translate --target vcs-commit-message

# Generate PR title and body from diff
git diff main | ultrahope translate --target pr-title-body

# Analyze PR intent
git diff main | ultrahope translate --target pr-intent
```

#### Targets

- `vcs-commit-message` - Generate a commit message
- `pr-title-body` - Generate PR title and body
- `pr-intent` - Analyze the intent of changes

## Configuration

### Environment Variables

- `ULTRAHOPE_API_URL` - API endpoint (default: `https://ultrahope.dev`)

### Credentials

Credentials are stored in `~/.config/ultrahope/credentials.json`.

## Development

```bash
# Build
pnpm run build

# Link for local testing
pnpm link --global
```
