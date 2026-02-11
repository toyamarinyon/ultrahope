# Issue #7: Service description doesn't mention the CLI tool

**Priority:** MEDIUM
**Status:** ✅ DONE

## Problem

**Terms state (Introduction):**
> "We operate https://ultrahope.dev, as well as any other related products and services..."

**Reality:** The CLI tool (`packages/cli`) is a core component of the service — arguably the primary interface. It is distributed as a separate package, authenticates via device flow, and makes direct API calls. The terms only reference the website.

**Relevant code:**
- `packages/cli/` — Entire CLI package
- `packages/cli/src/commands/` — commit, translate, jj, login commands
- `packages/web/app/device/` — Device flow authorization for CLI

## Recommended Action

Explicitly include the CLI tool in the service definition. For example: "We operate https://ultrahope.dev and the Ultrahope command-line interface (CLI), as well as any other related products and services..."

## Resolution

**Completed:** 2026-02-11

Updated the Introduction service definition to explicitly include the Ultrahope CLI as part of the Services covered by these Legal Terms.

**Files changed:**
- `packages/web/app/terms/terms.md:9`
