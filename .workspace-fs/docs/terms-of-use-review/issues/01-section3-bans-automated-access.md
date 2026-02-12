# Issue #1: Section 3 bans automated/bot access — contradicts CLI tool

**Priority:** HIGH
**Status:** ✅ DONE

## Problem

**Terms state (Section 3, User Representations):**
> "(3) you will not access the Services through automated or non-human means, whether through a bot, script or otherwise"

**Reality:** The CLI tool (`packages/cli`) is the primary interface for the service. It is literally a script that makes automated API calls (`POST /v1/commit-message`, `POST /v1/pr-title-body`, etc.) on behalf of the user. Every CLI invocation violates this clause.

**Relevant code:**
- `packages/cli/src/commands/commit.ts` — Automated API calls to generate commit messages
- `packages/cli/src/commands/translate.ts` — Automated API calls for PR title/body
- `packages/cli/src/api-client.ts` — OpenAPI-based HTTP client

## Recommended Action

Remove or rewrite this representation to exclude authorized CLI and API usage. For example: "you will not access the Services through unauthorized automated means" or explicitly carve out the official CLI and API.

## Resolution

**Completed:** 2026-02-11

Updated Section 3 in the Terms of Use to prohibit only unauthorized automation, rather than banning all automated or non-human access. This resolves the direct contradiction with authorized CLI/API usage.

**Updated wording (Section 3, item 3):**
> "you will not access the Services through unauthorized automated or non-human means, including through a bot, script, scraper, or similar method that is not expressly permitted by us"

**Files changed:**
- `packages/web/app/terms/terms.md:114`
