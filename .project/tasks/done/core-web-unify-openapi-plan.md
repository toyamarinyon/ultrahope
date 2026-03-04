# Core/Web Unification + OpenAPI Export + CLI Client Migration Plan

Goal: unify `packages/core` and `packages/web`, export the API as OpenAPI, and have the CLI consume generated types/clients.

## Principles

- Treat the Web/API side as a single server package
- OpenAPI is the source of truth (types are generated from OpenAPI)
- The CLI depends only on the generated client, not Web implementation details
- Breaking changes are handled deliberately (explicit migration steps)

## Scope

- Unify `packages/core` (remove it or move into web)
- Generate OpenAPI definitions (from Elysia routes)
- Generate types/clients from OpenAPI
- Replace CLI API calls with the generated client

## Steps (draft)

1. **Inventory**
   - Map responsibilities and dependencies across core/web/cli
   - Identify where the CLI directly references core
   - List API routes and current request/response schemas

2. **Unification design**
   - Decide the target structure (e.g. `packages/web/src/server/*`)
   - Define how core public APIs (translate, etc.) move into web
   - Decide when to remove `packages/core`

3. **OpenAPI generation approach**
   - Decide how Elysia generates OpenAPI (plugin, build-time, etc.)
   - Decide output location and update flow (e.g. `packages/web/openapi.json`)
   - Decide CI/local verification flow

4. **CLI client generation**
   - Choose the OpenAPI -> TypeScript client tooling
   - Decide how generated code ships with the CLI
   - Decide error types, auth headers, and retry strategy

5. **Migration**
   - Switch the CLI translate API to the generated client first
   - Remove the old API client
   - Remove or shrink `packages/core`

6. **Finish**
- Update docs (decisions + task notes + operational docs)
   - Prepare a breaking-change note if needed
   - E2E verification (CLI -> API)

## Status

- [x] 1. Inventory
- [x] 2. Unification design
- [x] 3. OpenAPI generation approach
- [x] 4. CLI client generation
- [x] 5. Migration (translate API on generated client)
- [x] 6. Finish (docs update, E2E)

## Key decisions

- OpenAPI generation: Elysia plugin
- OpenAPI output: `packages/web/openapi.json`
- Git policy: commit generated spec (later consider .gitignore after Turborepo migration)
- Client generator: openapi-ts.dev (openapi-typescript + openapi-fetch)
- Compatibility: no compatibility window (safe to migrate all at once)
- Decision record: `./../decisions/core-web-unify-openapi.md`

## Target structure (draft)

```
packages/web/
  src/
    server/
      app.ts            # Elysia app + OpenAPI plugin
      routes/
        auth.ts         # Better Auth routes (under /api/auth)
        translate.ts    # /api/v1/translate
        health.ts       # /api/health
      llm/
        translate.ts    # former core.translate + billing/usage
        prompts.ts      # former core/prompts.ts
        types.ts        # former core/types.ts
      openapi.ts        # OpenAPI config (title/version/security)
    app/api/[[...slugs]]/route.ts  # app.handle only
```

Note: move from `packages/web/src/lib` to `packages/web/src/server` to clarify the Next.js boundary.

## OpenAPI generation flow (draft)

- Apply OpenAPI plugin to the Elysia app
- Generate `packages/web/openapi.json` via a script and commit it
- Keep the generator in `packages/web/scripts/generate-openapi.mjs`

Example flow:

1) `pnpm -C packages/web run generate:openapi`
2) Commit `packages/web/openapi.json`
3) CLI types/clients are generated from `openapi.json`

## OpenAPI plugin configuration (final)

- path: `/openapi` (actual URL: `/api/openapi` via app prefix)
- specPath: `/openapi/json` (actual URL: `/api/openapi/json`)
- UI: enabled (Scalar or Swagger is fine)
- Auth: `/v1/*` uses Bearer, `/auth/*` is public
- Included routes: `translate` and `health` only (auth excluded)
- metadata:
  - title: fixed
  - version: read from `packages/web/package.json`

## Remaining decisions / validation

- None

## Risks and caveats

- OpenAPI type fidelity (avoid unknown/any)
- Ensure generated code is shipped with the CLI
- Local workflow changes after removing core
