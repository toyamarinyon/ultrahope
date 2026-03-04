# Issue #10: No mention of API rate limits or usage quotas

**Priority:** LOW
**Status:** ✅ DONE

## Problem

**Terms state:** Nothing about usage limits, rate limiting, or quotas.

**Reality:** The service enforces strict usage limits:
- Free plan: 5 requests per 24-hour rolling window
- Pro plan: Unlimited requests but credit-based overage billing
- API rate limiting exists at the application layer

**Relevant code:**
- `packages/web/lib/api.ts` — Daily limit enforcement logic
- `packages/web/lib/polar.ts` — Plan-based limit configuration

## Recommended Action

Add a clause reserving the right to impose usage limits and referencing the plan-specific quotas. This protects against abuse and sets user expectations.

## Resolution

**Completed:** 2026-02-11

Added a dedicated usage-limits section to the Terms to disclose quotas/rate limiting controls and enforcement behavior.

**Summary of changes:**
- Added clause that usage may be subject to quotas, rate limits, fair-use restrictions, request-size limits, and concurrency limits.
- Clarified that limits may vary by plan and may change over time.
- Added enforcement rights (throttle, delay, reject, suspend) for over-limit or abusive traffic.

**Files changed:**
- `packages/web/app/terms/terms.md:71`
