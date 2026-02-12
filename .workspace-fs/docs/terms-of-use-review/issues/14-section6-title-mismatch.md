# Issue #14: Section 6 title doesn't match content structure

**Priority:** LOW
**Status:** ✅ DONE

## Problem

**Terms structure:**
- **Section 6 title:** "CONTRIBUTION LICENSE"
- **Section 6 actual content:**
  1. Data processing consent (first 3 paragraphs)
  2. Feedback usage
  3. Ownership clarification
  4. **AI SERVICES AND GENERATED OUTPUT** (subsection with ### heading)

**Issue:** The section title "CONTRIBUTION LICENSE" suggests it's only about licensing user contributions, but the section actually contains:
- General data processing consent
- Feedback licensing
- Ownership statements
- **A major AI-related subsection** that is conceptually distinct

The AI subsection is substantial and arguably deserves its own top-level section, especially given its importance to the service.

## Recommended Action

**Option 1 (Restructure):** Move "AI SERVICES AND GENERATED OUTPUT" to a new Section 7, and renumber subsequent sections. This makes the AI terms more prominent and easier to find.

**Option 2 (Rename Section 6):** Rename Section 6 to something broader like "CONTRIBUTIONS, DATA PROCESSING, AND AI SERVICES" to reflect its actual content.

**Option 3 (Leave as-is):** Keep current structure but accept that the section title is somewhat misleading.

**Recommendation:** Option 1 is clearest and gives appropriate prominence to the AI terms, which are core to understanding how the service works.

## Resolution

**Completed:** 2026-02-11

Renamed Section 6 to reflect its actual scope (contributions, data use, and AI output) and updated the table-of-contents link accordingly.

**Summary of changes:**
- Section 6 title changed from "CONTRIBUTION LICENSE" to "CONTRIBUTIONS, DATA USE, AND AI OUTPUT".
- Table of contents entry updated to match the new section title and anchor.

**Files changed:**
- `packages/web/app/terms/terms.md:31`
- `packages/web/app/terms/terms.md:197`
