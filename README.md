# Ultrahope

You commit dozens of times a day.
The message shouldn't slow you down.

Your diff becomes multiple proposals — right in the terminal.
Tweak until it reads like you wrote it.

```
$ git ultrahope commit
✔ Found staged changes
3 commit messages generated (total: $0.000342)
up/down navigate · enter confirm

○ feat(api): add stream event timestamps and metadata support
  ministral-3b $0.0001049 871ms

○ refactor(api): restructure stream event metadata handling
  ministral-3b $0.0001049 871ms

● fix(api): add missing timestamp to stream events
  ministral-3b $0.0001049 871ms

enter confirm · e edit · r refine · E escalate
```

Pick one. Or press `e` to reword it. Or `r` to tell the model what to change. Or `E` to escalate to a more capable model.

The model drafts. You have the final word.

## Judge by the output, not the model name

A commit message is a single line. How much model do you need for one line?

Ultrahope generates candidates in parallel across models you choose. Small models are fast and cheap — often good enough. When they're not, escalate on the spot. You see the cost and latency of every candidate, so you decide what's worth it.

## Works with your flow

Coding agents are powerful, but the entire development flow doesn't belong inside a single agent. Ultrahope is a Unix-friendly CLI — it reads from stdin, writes to stdout, and composes with the tools you already use.

```bash
# Git — generate and commit in one step
git ultrahope commit

# Jujutsu — describe the current revision
jj ultrahope describe

# Pipe anything through translate
git diff --staged | ultrahope translate --target vcs-commit-message
git diff main | ultrahope translate --target pr-title-body
git diff main | ultrahope translate --target pr-intent
```

Provide context the diff can't show with `--guide`:

```bash
git ultrahope commit --guide "security fix for GHSA-gq3j-xvxp-8hrf"
```

In interactive mode, press `r` to refine with instructions like "shorter" or "more formal" — the model regenerates based on your guidance.

## Get started

```bash
npm install -g ultrahope
```

Authenticate once:

```bash
ultrahope login
```

Then commit:

```bash
git add -p
git ultrahope commit
```

For Jujutsu, run `ultrahope jj setup` to register the alias, then use `jj ultrahope describe`.

## Configuration

### Models

Models are resolved in this order (highest priority first):

1. CLI flag: `--models model1,model2`
2. Project config: nearest `.ultrahope.toml` or `ultrahope.toml` in current or parent directories
3. Global config: `${XDG_CONFIG_HOME:-~/.config}/ultrahope/config.toml`
4. Built-in defaults

```toml
models = ["mistral/ministral-3b", "xai/grok-code-fast-1"]
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `ULTRAHOPE_API_URL` | API endpoint (default: `https://ultrahope.dev`) |

### Credentials

Stored in `~/.config/ultrahope/credentials.json` after `ultrahope login`.

## Links

- [Website](https://ultrahope.dev)
- [Pricing](https://ultrahope.dev/pricing)
- [GitHub](https://github.com/toyamarinyon/ultrahope)

## License

This project uses a split license model:

- `packages/web` — [AGPL-3.0](packages/web/LICENSE)
- `packages/cli`, `packages/shared` — [MIT](LICENSE)
