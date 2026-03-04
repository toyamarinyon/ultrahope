# API/Web monolith

## Conclusion: merge packages/api into packages/web

### Background

Current structure:
- `packages/api` — ElysiaJS (Better Auth + Device Flow + translate)
- `packages/web` — Next.js (Landing page + Device verification page)

**Problems:**
- Two projects on Vercel → higher cost
- CORS/session sharing complexity
- Deployment/operations overhead

### Solution

Run ElysiaJS within a Next.js App Router Route Handler.

```
packages/web/src/app/api/[[...slugs]]/route.ts
```

ElysiaJS is WinterTC-compliant, so it works by exporting it as a Next.js Route Handler.

### Technical basis

1. **Official ElysiaJS + Next.js support**
   - https://elysiajs.com/integrations/nextjs

2. **Vercel Bun runtime (Public Beta)**
   - https://vercel.com/blog/bun-runtime-on-vercel-functions
   - Add `"bunVersion": "1.x"` to `vercel.json`
   - Preserve ElysiaJS Bun optimizations
   - No `@elysiajs/node` adapter needed

3. **End-to-end type safety via Eden**
   - Type-safe API calls from the frontend
   - tRPC-like DX

### Implementation steps

1. Create `packages/web/src/app/api/[[...slugs]]/route.ts`
2. Move code from `packages/api/src`
   - `lib/auth.ts` → `packages/web/src/lib/auth.ts`
   - `lib/llm.ts` → `packages/web/src/lib/llm.ts`
   - `db/` → `packages/web/src/db/`
3. Export the Elysia app from the Route Handler
4. Add Bun runtime setting to `vercel.json`
5. Remove `packages/api`
6. Remove the api workspace from root `package.json`

### Considerations

#### Better Auth basePath

Currently set to `basePath: "/api"`. Verify it still works after Next.js integration.

```typescript
// current
export const auth = betterAuth({
  basePath: "/api",
  // ...
})
```

#### Environment variables

Move `packages/api` environment variables into `packages/web`:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `RESEND_API_KEY`
- `DEVICE_VERIFICATION_URI`

#### GitHub OAuth Callback URL

After integration the origin is unified, so update the callback URL:
- Production: `https://ultrahope.dev/api/auth/callback/github`
- Development: `http://localhost:3000/api/auth/callback/github`

#### Cold start

The Bun runtime tends to have slower cold start than Node.js (per Vercel blog),
but CPU-intensive workloads are reported to be 28% faster.

#### pnpm peer dependencies

If using pnpm, extra dependencies may be required:
```bash
pnpm add @sinclair/typebox openapi-types
```
(Currently unnecessary if using Bun workspaces.)

### Directory structure (after)

```
packages/
├── cli/          # CLI (unchanged)
└── web/          # Next.js + ElysiaJS API
    ├── src/
    │   ├── app/
    │   │   ├── api/
    │   │   │   └── [[...slugs]]/
    │   │   │       └── route.ts    # ElysiaJS entry point
    │   │   ├── device/
    │   │   │   └── page.tsx
    │   │   ├── dashboard/          # New: post-login screen
    │   │   │   └── page.tsx
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── db/                     # moved from api
    │   │   ├── client.ts
    │   │   └── schema.ts
    │   └── lib/                    # moved from api
    │       ├── auth.ts
    │       └── llm.ts
    ├── vercel.json
    └── package.json
```

### Reference links

- [ElysiaJS Next.js Integration](https://elysiajs.com/integrations/nextjs)
- [Vercel Bun Runtime](https://vercel.com/blog/bun-runtime-on-vercel-functions)
- [Eden Treaty](https://elysiajs.com/eden/treaty/overview)
