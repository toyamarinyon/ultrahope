# Project structure

## Decision: Single Monorepo + npm files whitelist

**Single public monorepo, publish only the CLI to npm**

```
ultrahope/                    # public repo
  packages/
    cli/                      # npm publish target
      package.json
      src/
    api/                      # not published to npm
      src/
    web/                      # not published to npm (future)
      src/
```

### Mechanism

Limit publish targets via the `files` field in `packages/cli/package.json`:

```json
{
  "name": "ultrahope",
  "files": ["dist"],
  "bin": { "ultrahope": "./dist/index.js" }
}
```

Run `npm publish` only from the `packages/cli` directory. The api/web packages are never published to npm.

### Benefits

- **Single repo** - dev server, commits, CI/CD are centrally managed
- **Code sharing** - share types/utilities in `packages/shared`
- **Publish only CLI** - controlled via the `files` field
- **api/web remain private** - even if repo is public, manage env vars on deploy targets (Fly.io, Vercel, etc.)
