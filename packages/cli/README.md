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

`git ultrahope commit` と `ultrahope jj describe` では `--guide <text>` を使って、差分だけでは分からない生成意図を補足できます。

```bash
# git commit の生成補足
git add -A && git ultrahope commit --guide "GHSA-gq3j-xvxp-8hrf: override reason"

# jj describe の生成補足
jj ultrahope describe --guide "GHSA-gq3j-xvxp-8hrf: override reason"
```

`git ultrahope commit`、`ultrahope jj describe`、`ultrahope translate --target vcs-commit-message` のインタラクティブモードでは、`r` で再生成、`R`（Shift+r）で追加条件を入れて再生成できます。

#### guide と再生成条件の違い

- `--guide`:
  - 差分外の意図補助（例: 仕様番号、背景、変更意図）
- `R refine`:
  - 生成結果を見直して、次の再生成条件をインライン入力
  - 例: 「もう少しフォーマルに」「もう少し短く」
  - `Enter` だけで空入力にすると直前の条件をクリア
  - 途中で再指定した場合は最後の内容で上書き
- `R` は「追加条件付き再生成（refine）」です
- 送信時は内部で `guide` に統合して API に渡します。
  - `--guide` のみ指定: `guide = "<guide>"`
  - `R refine` のみ指定: `guide = "<refine>"`
  - 両方指定: `guide = "<guide>\n\nRefinement: <refine>"`

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
