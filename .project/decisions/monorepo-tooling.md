# Monorepo Tooling

## Decision: pnpm Workspaces

**Manage the monorepo with pnpm workspaces, build the CLI for Node, and publish to npm**

### Reasons

- Avoid dependence on Vercel’s Bun runtime and standardize on Node.js
- pnpm supports the npm-compatible `workspaces` field
- tsup can output a single file for Node.js
- Unifying the toolchain reduces complexity

### Structure

```
ultrahope/
  package.json          # workspaces: ["packages/*"]
  pnpm-workspace.yaml
  pnpm-lock.yaml
  packages/
    cli/                # tsup build → npm publish
    web/                # Next.js + ElysiaJS API
    shared/             # Shared types/utilities (future)
```

### CLI build

```bash
cd packages/cli
pnpm run build
npm publish
```

### References

- https://pnpm.io/workspaces
- https://tsup.egoist.dev/
