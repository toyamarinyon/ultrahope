# Jujutsu (jj) Integration

> This document represents to-be, not as-is

## Goal

Ultrahope integrates with jj workflows via `ultrahope jj <verb>` commands.

```bash
npm install -g ultrahope
ultrahope jj describe   # works!
```

## Why Not `jj ultrahope`?

Unlike git, jj does not have a subcommand discovery mechanism (`git-<name>` in PATH). So we add jj support as a subcommand of ultrahope itself.

## Commands

### `ultrahope jj describe`

Generate commit description from changes with interactive selection.

```bash
ultrahope jj describe              # interactive mode (default)
ultrahope jj describe -r @-        # for parent revision
ultrahope jj describe --dry-run    # print candidates only, don't describe
```

#### Interactive Flow

1. Run `jj diff -r <revision>` (default: `@`)
2. Call translate API to generate multiple candidates
3. Display interactive selector:

```
Select a commit message:

    > [1] feat: add user authentication       [2] fix: resolve memory leak        
                                                                                  
          Implement JWT-based auth flow           Fix unclosed DB connections     
          Add login/logout endpoints              Add proper cleanup handlers     
          Include session management                                              

      [3] refactor: simplify API layer        [4] docs: update README             
                                                                                  
          Extract common utilities                Add installation guide          
          Reduce code duplication                 Include API examples            
          Improve error handling                                                  

  [1-4] Select  [e] Edit  [Enter] Confirm  [r] Reroll
```

4. User selects, edits, or rerolls
5. On confirm: Run `jj describe --stdin -r <revision>`

#### Keybindings

| Key | Action |
|-----|--------|
| `1-4` | Select candidate |
| `↑/↓` or `j/k` | Navigate candidates |
| `e` | Edit selected in $EDITOR |
| `Enter` | Confirm and describe |
| `r` | Reroll (generate new candidates) |
| `q` or `Esc` | Abort |

### Options

| Flag | Description |
|------|-------------|
| `-r <revset>` | Revision to describe (default: `@`) |
| `--dry-run` | Print candidates to stdout, no interaction |
| `-n <count>` | Number of candidates to generate (default: 4) |

### `ultrahope jj pr` (future)

Generate PR title and body from branch changes.

```bash
ultrahope jj pr                    # print title + body
ultrahope jj pr --create           # pipe to `gh pr create`
```

## Implementation

Add `jj` subcommand to main CLI entry point:

```typescript
// src/index.ts
case "jj":
  await jj(args);
  break;
```

Create `src/commands/jj.ts` that dispatches to `describe`, etc.

## UX Considerations

- Default revision is `@` (matches jj's default for describe)
- `--dry-run` allows preview before modifying history
- Error clearly if not in a jj repository
- Error clearly if revision has no changes
