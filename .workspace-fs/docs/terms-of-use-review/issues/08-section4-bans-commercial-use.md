# Issue #8: Section 4 bans commercial use — contradicts Pro plan

**Priority:** MEDIUM
**Status:** ✅ DONE

## Problem

**Terms state (Section 4):**
> "The Services may not be used in connection with any commercial endeavors except those that are specifically endorsed or approved by us."

And:
> "Use the Services as part of any effort to compete with us or otherwise use the Services and/or the Content for any revenue-generating endeavor or commercial enterprise."

**Reality:** The Pro plan ($10/month) is explicitly designed for professional/commercial use. The pricing page markets features like "Priority support" and unlimited requests for professional workflows. Prohibiting commercial use contradicts the business model.

**Relevant code:**
- `packages/web/components/pricing-cards.tsx` — Pro plan marketed for professional use

## Recommended Action

Remove the blanket commercial use prohibition. Replace with language that permits commercial use under paid plans while prohibiting resale, redistribution, or competitive use of the service.

## Resolution

**Completed:** 2026-02-11

Resolved by the Section 4 rewrite completed in earlier updates. The prior blanket prohibition on commercial use was replaced with language that allows legitimate commercial use subject to plan terms, while prohibiting unauthorized resale/sublicensing and competitive cloning behavior.

**Files changed:**
- `packages/web/app/terms/terms.md:128`
- `packages/web/app/terms/terms.md:174`
