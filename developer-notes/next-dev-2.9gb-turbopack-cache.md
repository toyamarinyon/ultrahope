# Why `.next/dev/` Was 2.9 GB — Turbopack's Persistent Cache and Turborepo

**Date:** 2026-02-09  
**Next.js version:** 16.1.4  
**Turborepo:** monorepo setup  
**Package:** `@ultrahope/web` (`packages/web`)

---

## Summary

After upgrading to Next.js 16.1.4, the `.next/dev/` directory in our web package grew to 2.9 GB. The root cause was Turbopack's persistent filesystem cache (`.next/dev/cache/turbopack/`), which uses an LSM-tree key-value store and writes `.sst` files aggressively during development. Just 2 page visits generated 547 MB, with 434 MB (79%) being the Turbopack cache alone.

This matters for Turborepo because if `.next/dev/` is not excluded from build `outputs`, the massive dev cache gets swept into Turborepo's task cache — bloating cache artifacts and slowing down cache restore.

---

## What Happened

While optimizing Turborepo cache performance in our monorepo, we noticed the `.next/dev/` directory under `packages/web` had ballooned to 2.9 GB. The bulk of the size came from:

```
.next/dev/cache/turbopack/
├── *.sst          # LSM-tree SSTable files (hundreds of MBs each)
├── MANIFEST       # LSM manifest
└── ...
```

A quick test confirmed the growth rate: visiting just 2 pages during `next dev` generated ~547 MB total in `.next/dev/`, of which ~434 MB (79%) was the `turbopack/` cache directory.

---

## What We Investigated

### 1. How Turborepo's own monorepo handles this

We checked the [Turborepo repository's root `turbo.json`](https://github.com/vercel/turborepo/blob/main/turbo.json) and found that they explicitly exclude both `.next/cache/` and `.next/dev/` from build outputs:

```jsonc
// From vercel/turborepo turbo.json (line 59-65)
"build": {
  "outputs": [
    "dist/**/*",
    ".next/**/*",
    "!.next/cache/**/*",
    "!.next/dev/**/*"     // ← Key exclusion
  ],
  "dependsOn": ["^build"]
}
```

**Reference:** [opensrc/repos/github.com/vercel/turborepo/turbo.json, line 64](../opensrc/repos/github.com/vercel/turborepo/turbo.json)

### 2. When and why the exclusion was added

The `!.next/dev/**/*` exclusion was added in [PR #11419](https://github.com/vercel/turborepo/pull/11419) (commit `9c713e1` by [@anthonyshew](https://github.com/anthonyshew), January 10, 2026).

The PR was primarily about sitemap middleware exclusion for the docs site, but included a "tweaks" commit that:
- Upgraded Next.js from 16.0.10 → 16.1.1
- Added `!.next/cache/**/*` and `!.next/dev/**/*` to the build outputs

The timing is significant — the upgrade to 16.1.1 coincides exactly with when the `.next/dev/` bloat became a real operational problem.

### 3. Timeline of relevant Next.js features

| Feature | Introduced | Default | Docs |
|---|---|---|---|
| `isolatedDevBuild` (dev output separated to `.next/dev/`) | Next.js 16.0 | `true` | [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16) |
| `turbopackFileSystemCacheForDev` (persistent FS cache for Turbopack) | Next.js 16.0 (beta, manual opt-in) | `false` in 16.0 | — |
| `turbopackFileSystemCacheForDev` becomes stable & default-on | Next.js 16.1 | `true` | [Next.js 16.1 Blog Post](https://nextjs.org/blog/next-16-1) |

Key insight:
- In Next.js 16.0, `isolatedDevBuild` moved dev output to `.next/dev/`, and the Turbopack FS cache existed but was opt-in.
- In Next.js 16.1, `turbopackFileSystemCacheForDev` became default-on, causing `.next/dev/cache/turbopack/` to grow unboundedly during development.
- Neither the Next.js 16.1.0 nor 16.1.1 release notes mention that Turborepo users should exclude `.next/dev/`. The exclusion was the Turborepo team's own operational discovery.

### 4. The config option to disable it

`turbopackFileSystemCacheForDev` is a `next.config.ts` experimental option:

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackFileSystemCacheForDev: false, // disables persistent cache writes
  },
};

export default nextConfig;
```

Setting it to `false` disables the `.next/dev/cache/turbopack/` writes entirely. This trades faster dev server warm starts for disk space.

---

## What We Did (The Fix)

We added the exclusion to our `packages/web/turbo.json`, matching what the Turborepo team does:

```jsonc
// packages/web/turbo.json
{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": {
      "outputs": [".next/**", "!.next/cache/**", "!.next/dev/**"],
      "env": ["TURSO_*", "RESEND_API_KEY", "GITHUB_*", "EMAIL_FROM", "POLAR_*"],
      "inputs": ["$TURBO_DEFAULT$", ".env.*"]
    }
  }
}
```

The key output exclusions are:
- `!.next/cache/**` — Next.js build cache (not needed in Turborepo cache)
- `!.next/dev/**` — Turbopack dev cache + dev build output (2.9 GB of LSM-tree files)

---

## Key Takeaway

If you use **Next.js ≥ 16.1** with **Turbopack** in a **Turborepo monorepo**, you must exclude `.next/dev/**` from your build outputs in `turbo.json`. Otherwise, the Turbopack persistent filesystem cache (which is now on by default) will be captured in your Turborepo task cache, causing multi-GB cache artifacts.

Alternatively, you can set `turbopackFileSystemCacheForDev: false` in `next.config.ts` to disable the persistent cache entirely, at the cost of slower dev server restarts.

---

## References

| Resource | URL / Path |
|---|---|
| Turborepo `turbo.json` with exclusion (line 64) | [opensrc copy](../opensrc/repos/github.com/vercel/turborepo/turbo.json) / [GitHub](https://github.com/vercel/turborepo/blob/main/turbo.json) |
| PR #11419 (added the exclusion) | https://github.com/vercel/turborepo/pull/11419 |
| Commit `9c713e1` by anthonyshew | https://github.com/vercel/turborepo/commit/9c713e1 |
| Next.js 16 Upgrade Guide (`isolatedDevBuild`) | https://nextjs.org/docs/app/guides/upgrading/version-16 |
| Next.js 16.1 Blog Post (`turbopackFileSystemCacheForDev` stable) | https://nextjs.org/blog/next-16-1 |
| Our `packages/web/turbo.json` | [packages/web/turbo.json](../packages/web/turbo.json) |
| Our `packages/web/next.config.ts` | [packages/web/next.config.ts](../packages/web/next.config.ts) |
