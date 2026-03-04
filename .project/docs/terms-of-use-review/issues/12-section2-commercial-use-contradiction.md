# Issue #12: Section 2 "non-commercial use" contradicts paid commercial plans

**Priority:** MEDIUM
**Status:** ✅ DONE

## Problem

**Terms state (Section 2, "Your use of our Services"):**
> "The Content and Marks are provided in or through the Services 'AS IS' for your personal, non-commercial use or internal business purpose only."

And later:
> "solely for your personal, non-commercial use or internal business purpose."

**Reality:** The Pro plan ($10/month) is explicitly marketed for professional/commercial use. While Section 4 was updated to allow commercial use "subject to your plan and these Legal Terms," Section 2 still contains contradictory language restricting use to "non-commercial" purposes.

This creates confusion: Section 4 allows commercial use under plan terms, but Section 2 restricts all Content/Marks to non-commercial use.

**Relevant code:**
- `packages/web/components/pricing-cards.tsx` — Pro plan for professional/commercial workflows
- Pro plan features: unlimited requests, priority support

## Recommended Action

Update Section 2 language to align with Section 4. Replace "non-commercial use" with language that permits commercial use subject to plan terms and the prohibition on resale/redistribution. For example:

> "The Content and Marks are provided in or through the Services 'AS IS' for your use in accordance with your plan terms and subject to the restrictions in these Legal Terms."

Or more specifically:
> "...for your personal use, internal business use, or other uses permitted under your plan terms, subject to the restrictions in these Legal Terms."

## Resolution

**Completed:** 2026-02-11

Updated Section 2 wording to remove "non-commercial use" restrictions that conflicted with paid commercial usage allowed elsewhere in the Terms.

**Summary of changes:**
- Revised the Content/Marks usage sentence to permit use under plan terms and these Legal Terms.
- Revised the license bullet for downloaded/printed content with matching wording.
- Preserved restrictions on unauthorized commercial exploitation of Content/Marks.

**Files changed:**
- `packages/web/app/terms/terms.md:95`
- `packages/web/app/terms/terms.md:104`
