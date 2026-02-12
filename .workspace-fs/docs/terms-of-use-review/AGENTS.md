# Terms of Use Review — Structure and Workflow

## Directory Structure

```
terms-of-use-review/
├── AGENTS.md                           # This file (workflow documentation)
├── terms-of-use-review.md             # Index/summary of all issues
└── issues/                             # Individual issue files
    ├── 01-section3-bans-automated-access.md
    ├── 02-section4-bans-automated-use.md
    ├── 03-submissions-clause-ip-assignment.md
    ├── 04-section5-contradicts-itself.md
    ├── 05-no-ai-llm-disclaimers.md
    ├── 06-no-pricing-subscription-terms.md
    ├── 07-no-cli-in-service-description.md
    ├── 08-section4-bans-commercial-use.md
    ├── 09-european-arbitration-chamber.md
    ├── 10-no-api-rate-limits.md
    └── 11-no-account-terms.md
```

## File Purposes

### `terms-of-use-review.md` (Index)
- **Purpose:** High-level overview and progress tracking
- **Contents:**
  - Metadata (date, file reviewed, overall status)
  - Progress table (all issues at a glance)
  - Accurate sections (no action needed)
  - Brief issue summaries with links to individual files

### `issues/*.md` (Individual Issues)
- **Purpose:** Detailed tracking of each specific issue
- **Contents:**
  - Priority and status
  - Problem description with quotes from terms
  - Reality check with code references
  - Recommended action
  - Resolution notes (filled when resolved)

## Workflow for Updating Issues

### Starting Work on an Issue

1. **Open the issue file** (e.g., `issues/01-section3-bans-automated-access.md`)
2. **Update status** in the issue file:
   ```markdown
   **Status:** 🔧 IN PROGRESS
   ```
3. **Update the index** (`terms-of-use-review.md`):
   - Update the matching row in the Progress table
   - Update the top-level Status if needed (⬜→🔧)

### Completing an Issue

1. **In the issue file:**
   - Update status: `**Status:** ✅ DONE`
   - Fill in the Resolution section with:
     - Summary of what was done
     - Links to commits/PRs/files changed
     - Date completed

   Example:
   ```markdown
   ## Resolution

   **Completed:** 2026-02-11

   Rewrote Section 3 to exclude authorized CLI and API usage. Changed clause (3) to:
   > "(3) you will not access the Services through unauthorized automated or non-human means"

   Added clarifying language that the official CLI tool and API are permitted.

   **Files changed:**
   - `packages/web/app/terms/terms.md:113-115`

   **Commit:** abc1234
   ```

2. **Update the index** (`terms-of-use-review.md`):
   - Update the matching row in the Progress table (status to ✅)
   - If all issues are ✅ or ⏭️, update top-level Status to 🟢 Complete

### Deferring an Issue

1. **In the issue file:**
   - Update status: `**Status:** ⏭️ DEFERRED`
   - Fill in Resolution with reason:
   ```markdown
   ## Resolution

   **Deferred:** 2026-02-11
   **Reason:** Waiting for legal review before making changes to arbitration clause.
   Will revisit after Q1 2026 legal audit.
   ```

2. **Update the index** as above

## Status Values

| Emoji | Meaning |
|-------|---------|
| ⬜ | TODO — not started |
| 🔧 | IN PROGRESS — work underway |
| ✅ | DONE — resolved and verified |
| ⏭️ | DEFERRED — intentionally postponed with reason noted in Resolution |

## Rules

1. **Never change issue numbers** — they are stable identifiers
2. **Always keep index and issue files in sync** — update both when changing status
3. **Resolution sections are required** when marking ✅ DONE or ⏭️ DEFERRED
4. **Don't delete issues** — only change their status
5. **Link to code** — use `file_path:line_number` format for references
6. **Date resolutions** — always include completion/deferral date

## Adding New Issues

If new issues are discovered:

1. **Create a new issue file** in `issues/` with the next sequential number:
   ```bash
   touch issues/12-new-issue-name.md
   ```

2. **Use the template structure:**
   ```markdown
   # Issue #12: Brief title

   **Priority:** HIGH|MEDIUM|LOW
   **Status:** ⬜ TODO

   ## Problem

   **Terms state:** ...

   **Reality:** ...

   ## Recommended Action

   ...

   ## Resolution

   <!-- When resolved, update status above and fill in details here -->
   ```

3. **Add to the index** (`terms-of-use-review.md`):
   - Add row to Progress table
   - Add to appropriate priority section

## Reviewing the Index

The `terms-of-use-review.md` file should be regenerated periodically to stay in sync:

```bash
# After updating multiple issue files, regenerate the index:
# (This is a manual process — read all issues/*.md and rebuild the summary)
```

The index serves as a dashboard. The individual issue files are the source of truth.
