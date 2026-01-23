# Git Subcommand Integration

> This document represents to-be, not as-is

## Goal

Installing ultrahope via npm also enables `git ultrahope <verb>` commands.

```
npm install -g ultrahope
git ultrahope commit   # works!
```

## How Git Subcommands Work

Git looks for executables named `git-<name>` in PATH. When you run `git foo`, git executes `git-foo`.

## Implementation

The npm package exposes multiple bins:

```json
{
  "bin": {
    "ultrahope": "./dist/index.js",
    "git-ultrahope": "./dist/git-ultrahope.js",
    "git-hope": "./dist/git-ultrahope.js",
    "git-uh": "./dist/git-ultrahope.js"
  }
}
```

When installed globally, npm places all of these in PATH → git finds them.

Users can pick their preferred alias:
- `git ultrahope commit` — explicit, full name
- `git hope commit` — friendly, memorable
- `git uh commit` — fast, minimal

## Commands

### `git ultrahope commit`

Generate commit message from staged changes with interactive selection.

```bash
git ultrahope commit              # interactive selector (default)
git ultrahope commit -m           # commits with selected message
git ultrahope commit --dry-run    # print candidates only, don't commit
git ultrahope commit --no-interactive  # single candidate, open editor
```

#### Interactive Flow

1. Run `git diff --cached`
2. Call translate API to generate multiple candidates
3. Display interactive selector (see [cli.md](cli.md#interactive-selector))
4. User selects, edits, or rerolls
5. On confirm: Run `git commit -m "<selected message>"`

#### Options

| Flag | Description |
|------|-------------|
| `-m` | Commit directly after selection (no editor) |
| `--dry-run` | Print candidates only |
| `--no-interactive` | Single candidate, open in editor |
| `-n <count>` | Number of candidates (default: 4) |

### `git ultrahope pr` (future)

Generate PR title and body from branch diff.

```bash
git ultrahope pr              # print title + body
git ultrahope pr --create     # pipe to `gh pr create`
```

### `git ultrahope review` (future)

AI review of staged changes.

```bash
git ultrahope review          # review staged changes
git ultrahope review HEAD~3   # review last 3 commits
```

## UX Consideration

- `git ultrahope commit` should feel native to git workflow
- Minimal flags, sensible defaults
- Fast feedback (streaming output if possible)
