# Ultrahope CLI

```
npm install -g ultrahope
```

> This document represents to-be, not as-is

## Interactive Selector

The default behavior for `translate` (and commands built on it) is an interactive selector that:

1. Generates multiple candidates
2. Displays them in a grid layout
3. Lets user select, edit, or reroll

```
Select a result:

    > [1] feat: add user authentication       [2] fix: resolve memory leak        
                                                                                  
          Implement JWT-based auth flow           Fix unclosed DB connections     
          Add login/logout endpoints              Add proper cleanup handlers     

  [1-4] Select  [e] Edit  [Enter] Confirm  [r] Reroll  [q] Abort
```

| Key | Action |
|-----|--------|
| `1-4` | Select candidate |
| `↑/↓` or `j/k` | Navigate |
| `e` | Edit selected in $EDITOR |
| `Enter` | Confirm selection |
| `r` | Reroll (regenerate) |
| `q` / `Esc` | Abort |

Use `--no-interactive` or pipe output to skip interactive mode.

---

## Commands

### ultrahope translate

```bash
git diff | ultrahope translate --target vcs-commit-message
git diff | ultrahope translate --target vcs-commit-message --no-interactive
```

| Option | Description |
|--------|-------------|
| `--target`, `-t` | Output format (required) |
| `--no-interactive` | Print single result, skip selector |

Targets: `vcs-commit-message`, `pr-title-body`, `pr-intent`

### ultrahope jj describe

See [jj-subcommand.md](jj-subcommand.md)

### ultrahope login

Login with device flow.

---

## Git Subcommands

After global install, git subcommands are available:

```bash
git ultrahope commit    # or: git hope commit, git uh commit
```

See [git-subcommand.md](git-subcommand.md)
