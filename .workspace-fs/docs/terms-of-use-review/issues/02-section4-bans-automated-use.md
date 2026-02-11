# Issue #2: Section 4 bans automated use/scripts — contradicts CLI tool

**Priority:** HIGH
**Status:** ⬜ TODO

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

<!-- When resolved, update status above and fill in details here -->
