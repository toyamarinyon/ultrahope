# Issue #2: Section 4 bans automated use/scripts — contradicts CLI tool

**Priority:** HIGH
**Status:** ✅ DONE

## Problem

**Terms state (Section 4, Prohibited Activities):**
> "Engage in any automated use of the system, such as using scripts to send comments or messages, or using any data mining, robots, or similar data gathering and extraction tools."

**Reality:** Same as Issue #1. The CLI tool is a script that automates interaction with the service. This prohibition would make normal use of the product a terms violation.

Additionally, Section 4 states:
> "Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise."

This contradicts the existence of the Pro plan (see Issue #8).

**Relevant code:**
- `packages/cli/` — Entire CLI package
- `packages/cli/src/commands/` — commit, translate, jj, login commands

## Recommended Action

Rewrite the prohibited activities to carve out authorized CLI/API usage and legitimate commercial use under paid plans.

## Resolution

**Completed:** 2026-02-11

Updated Section 4 in the Terms of Use to prohibit only unauthorized automation and to explicitly allow authorized tools and APIs, including the official CLI. Also removed blanket commercial-use prohibition and replaced it with a narrower competitive-use restriction.

**Summary of changes:**
- Updated opening paragraph of Section 4 to allow legitimate commercial use under plan terms and prohibit resale/sublicensing without permission.
- Rewrote automated-use prohibition to target unauthorized, abusive, spam, or fraudulent automation.
- Added explicit carve-out for expressly permitted tools and APIs, including the official Ultrahope CLI.
- Replaced broad "revenue-generating endeavor or commercial enterprise" prohibition with a narrower competition/clone-building restriction.

**Files changed:**
- `packages/web/app/terms/terms.md:120`
- `packages/web/app/terms/terms.md:142`
- `packages/web/app/terms/terms.md:160`
- `packages/web/app/terms/terms.md:166`
