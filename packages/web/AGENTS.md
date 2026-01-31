# AGENTS.md (packages/web)

## OpenAPI specification

Do not modify `openapi.json` directly. To update it, run:

```bash
pnpm -C packages/web generate:openapi
```

## Polar SDK change workflow

When making changes that include or affect the Polar SDK usage in `packages/web`:

1. Read `.workspace-fs/docs/polar/oat.md` before coding.
2. If your change requires additional Polar OAT scopes, update
   `.workspace-fs/docs/polar/oat.md` to document the new scopes and why they
   are needed.

