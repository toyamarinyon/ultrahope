# Halo CLI rename migration strategy

Date: 2026-04-30

Status: Proposed

Related task: `./.project/tasks/backlog/rename-cli-to-halo.md`

## Context

`Ultrahope` is becoming the parent brand and site root for Satoshi's personal site, activities, writing, and future work. The existing command-line product remains valuable, but should be presented as `Halo`, a CLI product under Ultrahope.

The current user base is small enough that a product rename is acceptable, but existing installs and scripts should keep working during the migration. This strategy treats the rename as a product-facing migration first, not a full internal namespace rewrite.

## Decision

Use `Halo` as the primary CLI product name, while preserving existing Ultrahope command, configuration, credential, and backend identifiers until there is a specific reason and plan to change them.

The primary package and command path should become:

- npm package: `@ultrahope/halo`
- CLI binary: `halo`
- Git command: `git halo commit`
- Jujutsu commands: `jj halo describe` and `jj halo commit`
- Jujutsu setup command: `halo jj setup`

The legacy command paths remain supported during the migration:

- `ultrahope`
- `git ultrahope`
- `git hope`
- `git uh`

Help text for legacy commands should continue to explain the old invocation, but should also point users toward Halo as the new primary name.

## Command compatibility

The Halo package should expose the new command names while keeping compatibility aliases:

- `halo` should be the canonical CLI entry point.
- `git-halo` should be the canonical Git subcommand entry point.
- `ultrahope` should remain a compatibility CLI entry point.
- `git-ultrahope`, `git-hope`, and `git-uh` should remain compatibility Git subcommand entry points.

`halo jj setup` should register a `jj halo` alias. Existing `jj ultrahope` aliases should keep working if already configured, but new documentation should prefer `jj halo`.

For a transition period, both jj aliases may be supported:

- `aliases.halo = ["util", "exec", "--", "halo", "jj"]`
- `aliases.ultrahope = ["util", "exec", "--", "ultrahope", "jj"]`

The CLI should avoid overwriting an existing user-defined alias unless the user explicitly asks for a repair or migration command.

## Package strategy

Publish `@ultrahope/halo` as the canonical npm package.

Keep the existing `ultrahope` package as a compatibility path during the migration. The compatibility package can either continue shipping the same implementation or depend on and delegate to `@ultrahope/halo`, depending on what is safest for the publishing workflow.

The first implementation pass should not require a package-name swap that breaks local development or workspace dependencies. It is acceptable to update package metadata and docs first, then finalize publishing mechanics in the release pass.

## Configuration and credentials

Do not change config and credential paths in the first rename pass.

Keep reading and writing:

- `~/.config/ultrahope/config.toml`
- `~/.config/ultrahope/credentials.json`
- nearest project `.ultrahope.toml`
- nearest project `ultrahope.toml`

This avoids surprising existing users and keeps current installs working. Product-facing docs may mention that these paths retain the old namespace for compatibility.

Introduce Halo config paths only after a separate migration plan defines:

- read precedence between Halo and Ultrahope paths
- whether writes should go to the old path, the new path, or both
- whether an automatic one-time copy is allowed
- how conflicts are reported when both paths exist
- how users can opt out or explicitly migrate

Recommended future precedence if Halo paths are added:

1. Explicit CLI flags
2. Project Halo config, such as `.halo.toml`
3. Project legacy config, `.ultrahope.toml` or `ultrahope.toml`
4. Global Halo config, such as `~/.config/halo/config.toml`
5. Global legacy config, `~/.config/ultrahope/config.toml`
6. Built-in defaults

Credential migration should be more conservative than model config migration. Authentication state should remain in the legacy path until the CLI has an explicit, tested migration command or a clear fallback strategy.

## Environment variables

Keep `ULTRAHOPE_API_URL` as the stable environment variable in the first rename pass.

Do not introduce `HALO_API_URL` unless the CLI implements clear precedence and docs. If introduced later, recommended precedence is:

1. `HALO_API_URL`
2. `ULTRAHOPE_API_URL`
3. default production API URL

If both variables are set to different values, the CLI should either warn or document that `HALO_API_URL` wins.

## Backend and external services

Backend internals may keep Ultrahope identifiers when changing them would add operational risk without user-facing benefit.

Keep these unchanged in the first rename pass:

- OAuth/client identifiers such as `ultrahope-cli`
- API route internals
- database identifiers
- Polar product, customer, subscription, and environment configuration names
- existing production domain references where they refer to the service root rather than the CLI product name

Only rename external service identifiers in a separate operational task with rollback notes.

## Web information architecture

`ultrahope.dev` should be able to become the root for the parent brand and personal/activity/writing site. The current CLI marketing surface should remain available as a product page, for example:

- `/halo`
- `/tools/halo`

The first web pass should make Halo the primary product name in CLI-facing marketing, docs, install commands, examples, SEO metadata, Open Graph text, pricing links, and footer links.

Legal, privacy, auth, billing, and API copy should be reviewed separately before replacing every occurrence of Ultrahope, because some of those references may refer to the service, company/operator, domain, or legal mark rather than the CLI product.

## Release and migration notes

The release notes should explain:

- Ultrahope CLI is now Halo.
- New installs should use `npm i -g @ultrahope/halo`.
- New Git usage should use `git halo commit`.
- New Jujutsu usage should use `halo jj setup`, then `jj halo describe` or `jj halo commit`.
- Existing commands continue to work during migration.
- Existing config and credentials remain in the Ultrahope paths for now.
- `ULTRAHOPE_API_URL` remains supported.

## Consequences

This keeps the rename low-risk and user-visible while avoiding a brittle internal namespace migration. The tradeoff is that users may see some legacy Ultrahope identifiers in config paths, environment variables, or advanced docs during the transition. That inconsistency is acceptable if it is documented clearly and removed only through a later, explicit migration.
