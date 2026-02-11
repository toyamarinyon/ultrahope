# Issue #13: Section 5 ends with incomplete sentence

**Priority:** LOW
**Status:** ✅ DONE

## Problem

**Terms state (Section 5, last sentence):**
> "When you create or submit any Contributions, you represent and warrant that:"

This sentence ends with a colon but has no content following it. The section appears incomplete.

**Expected:** Either complete the list of representations/warranties, or remove the incomplete sentence entirely (since Section 2 already covers user responsibilities for submissions).

## Recommended Action

**Option 1 (Remove):** Delete the incomplete sentence. Section 2 "Your submissions" already covers user responsibilities comprehensively:
- Users retain rights to Input Content
- Users are responsible for what they submit
- Users confirm they have rights to submit content

**Option 2 (Complete):** Add specific representations relevant to Contributions, such as:
- Contributions do not violate third-party rights
- Contributions do not contain malware or harmful code
- Contributions comply with applicable laws

Given that Section 2 already addresses these points, **Option 1 (removal)** is cleaner and avoids redundancy.

## Resolution

**Completed:** 2026-02-11

Removed the incomplete trailing clause in Section 5 that ended with a colon and no follow-up content.

**Summary of changes:**
- Deleted the unfinished "you represent and warrant that:" tail sentence from the Section 5 paragraph.
- Kept Section 5 concise and non-redundant since submission responsibilities are already covered in Section 2.

**Files changed:**
- `packages/web/app/terms/terms.md:195`
