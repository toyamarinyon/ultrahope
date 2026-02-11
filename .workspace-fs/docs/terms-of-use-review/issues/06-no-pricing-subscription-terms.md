# Issue #6: No pricing, subscription, or refund terms for a paid service

**Priority:** MEDIUM
**Status:** ⬜ TODO

## Problem

**Terms state:** Nothing about pricing, payment, subscriptions, billing, or refunds.

**Reality:** The service has a full billing system:
- **Free plan:** $0/month, 5 requests/day
- **Pro plan:** $10/month, unlimited requests, $5 monthly credit, pay-as-you-go overage
- Payment processing via Polar.sh
- Credit system with auto-recharge option
- Usage metering in microdollars

**Relevant code:**
- `packages/web/lib/polar.ts` — Polar SDK integration, product IDs
- `packages/web/app/api/subscription/` — Upgrade/downgrade endpoints
- `packages/web/components/pricing-cards.tsx` — Pricing UI
- `packages/web/lib/api.ts:250-284` — Usage event ingestion for billing

## Recommended Action

Add a section covering:
- Description of available plans and pricing (or reference a pricing page)
- Billing cycle and payment terms
- Refund/cancellation policy
- Credit system and overage billing
- Right to change pricing with notice

## Resolution

<!-- When resolved, update status above and fill in details here -->
