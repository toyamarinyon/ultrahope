# Issue #10: No mention of API rate limits or usage quotas

**Priority:** LOW
**Status:** ⬜ TODO

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

<!-- When resolved, update status above and fill in details here -->
