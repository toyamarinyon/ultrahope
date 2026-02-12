# CLI Config File

## Status

Accepted

## Context

Multi-model generation is implemented: the translate API accepts a `models` param, and the selector UI shows the model name per candidate. The remaining piece was "Build settings UI for user model preferences" — a web UI on ultrahope.dev where users would configure their preferred model set, and the CLI would fetch those preferences from the API.

However, this approach has fundamental problems:

1. **No per-project configuration.** A shared setting on ultrahope.dev applies globally. Different projects benefit from different model sets — an OSS side-project may want fast/cheap models, while a work project may warrant higher-quality (and more expensive) models.
2. **Override complexity.** Adding per-project overrides on top of a server-side setting requires a layering mechanism anyway (env vars? CLI flags? local files?). We'd end up building a config resolution system regardless.
3. **Network dependency for defaults.** The CLI would need to call the API just to know which models to use, adding latency and a failure mode before any actual generation begins.
4. **Unnecessary coupling.** The ultrahope.dev web app's responsibility is authentication, billing, and API serving. Model preferences are a CLI-side concern — the API doesn't care which models the CLI chose, it just serves whatever `models` param it receives.

Tools like [mise](https://mise.jdx.dev/) and [Amp](https://ampcode.com/) solve this well with hierarchical config files that can be placed at global and project levels. This is a well-understood pattern in the developer tools ecosystem.

## Decision

Use **local config files** (TOML) with hierarchical resolution instead of a server-side settings UI.

### Why TOML?

- Comments are supported (unlike JSON) — important for config files that humans edit
- Widely used in developer tooling (Cargo, mise, Python pyproject.toml)
- Simple and flat — our config surface is small, no need for YAML complexity
- Consistent with `mise.toml` already present in the repo

### Why not the server-side settings UI?

The original plan assumed model preferences are a "user account" concern. In practice, they are a "workspace" concern — like `.editorconfig` or `biome.json`. The config file approach:

- Eliminates a web UI feature to build and maintain
- Lets ultrahope.dev focus on auth, billing, and API
- Gives users the flexibility they actually need (per-project config)

## Config File Locations

### Project-level

Two filenames are recognized (searched in order within each directory):

1. `.ultrahope.toml` — dotfile convention, easy to `.gitignore` for personal preferences
2. `ultrahope.toml` — visible, suitable for team-shared configuration

If both exist in the same directory, `.ultrahope.toml` takes precedence.

The CLI walks up from `cwd` toward the filesystem root, checking each directory. The first match wins (nearest ancestor).

### Global

`~/.config/ultrahope/config.toml` (respects `XDG_CONFIG_HOME`)

This lives alongside the existing `credentials.json` in the same config directory.

### Resolution Order

Highest priority wins. No merging between levels.

| Priority | Source | Example |
|----------|--------|---------|
| 1 (highest) | CLI flag | `--models openai,cerebras` |
| 2 | Project config | `./ultrahope.toml` or `./.ultrahope.toml` (nearest ancestor) |
| 3 | Global config | `~/.config/ultrahope/config.toml` |
| 4 (lowest) | Built-in default | Hardcoded `DEFAULT_MODELS` |

**No merging:** If a project config specifies `models`, it completely replaces the global config's `models`. This keeps behavior predictable — you always know exactly which models will be used by looking at one source.

## Config Format

```toml
# Models to use for generation (each model produces one candidate)
models = ["mistral/ministral-3b", "xai/grok-code-fast-1"]
```

The schema is intentionally minimal. Only `models` is needed today. The TOML format allows future extension without breaking changes.

## Auto-Generation on First Login

When `ultrahope login` succeeds and `~/.config/ultrahope/config.toml` does not yet exist, the CLI creates it with default values:

```toml
# Ultrahope CLI configuration
# https://github.com/toyamarinyon/ultrahope

# Models to use for generation (each model produces one candidate)
# Available models: mistral/ministral-3b, xai/grok-code-fast-1, openai/gpt-5-nano, cerebras/llama-3.1-8b
models = ["mistral/ministral-3b", "xai/grok-code-fast-1"]
```

This gives users a working config they can immediately customize, and makes the config file discoverable without requiring users to read documentation first.

**Why on login, not on first command?** Login is already a setup step that writes to `~/.config/ultrahope/`. Generating the config alongside credentials feels natural. Generating it on first command (e.g., `git ultrahope commit`) would mix config setup into the middle of a workflow.

## Implementation

### New file: `packages/cli/lib/config.ts`

Responsibilities:
- Parse TOML config files
- Walk directory tree to find project-level config
- Resolve config with priority order
- Export a `resolveModels(cliModels?: string[]): string[]` function

### Changes to existing code

| File | Change |
|------|--------|
| `lib/vcs-message-generator.ts` | `DEFAULT_MODELS` remains as built-in fallback (priority 4) |
| `commands/commit.ts` | Call `resolveModels(parsedModels)` instead of `models \|\| DEFAULT_MODELS` |
| `commands/jj.ts` | Same pattern |
| `commands/translate.ts` | Same pattern |
| `commands/login.ts` | Generate `config.toml` on successful login |

### TOML parsing

Use a lightweight TOML parser. Options:
- `smol-toml` — small, zero-dependency, ESM-native
- `@iarna/toml` — battle-tested, slightly larger

Preference: `smol-toml` for bundle size (CLI is distributed on npm, smaller is better).

## Impact on multi-model-generation.md

The "Default model set & User Configuration" section of the to-be spec described a web-based settings flow. This decision replaces that approach. The to-be spec should be updated to reflect the config file approach and the "Build settings UI for user model preferences" task in state.md should be replaced with config file implementation tasks.
