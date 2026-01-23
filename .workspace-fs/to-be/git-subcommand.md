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

Generate commit message from staged changes.

```bash
git ultrahope commit          # generates message, opens editor
git ultrahope commit -m       # generates message, commits directly
git ultrahope commit --dry-run  # print message only, don't commit
```

Internally:
1. Run `git diff --cached`
2. Pipe to translate API with `--target vcs-commit-message`
3. Open editor / commit / print

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
