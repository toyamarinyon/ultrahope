# Billing Meter Design: Token-Based Usage Tracking

## Context

We are implementing usage-based billing with Polar.sh for Ultrahope, an LLM-powered development workflow assistant. This document captures our investigation and design decisions around meters and benefits.

## Problem Statement

We need to track and limit user usage across different subscription tiers (Free, Pro, Team). The key questions were:

1. What unit should we track? (API requests vs tokens)
2. What reset interval is appropriate? (daily vs monthly)
3. How do benefit changes affect existing subscribers?

## Investigation Summary

### Polar.sh Meter and Benefit System

**Meters** filter and aggregate events ingested from the application. They define:
- Filter: Which events to count (e.g., `name == "api_request"`)
- Aggregation: How to aggregate (count, sum, avg, etc.)

**Benefits** are granted to customers when they subscribe to a product. The `meter_credit` benefit type credits units to a customer's meter balance.

### Key Findings

#### 1. Benefit Credit Timing

Credits are granted **at the beginning of each billing cycle**, not immediately when a benefit is modified.

> "If the billing cycle is recurring, units will be credited at the beginning of each period."

This means:
- User consumes 5 of 10 credits (balance: 5)
- Admin updates benefit from 10 → 20 credits
- User's balance remains 5 until next billing cycle
- At next cycle start, user receives 20 credits

#### 2. No Daily Reset Support

Neither Polar.sh nor Stripe supports daily credit reset out of the box. Both platforms tie meter credits to the subscription billing cycle (monthly/yearly).

If daily limits are required in the future, we would need to implement this at the application layer.

#### 3. Benefit Addition/Removal vs Property Changes

- **Adding/removing benefits** → Immediate effect on existing subscribers
- **Changing benefit properties** (e.g., units) → Takes effect at next billing cycle

### Meter Filter Configuration

During testing, we discovered the meter filter must use the correct property name:
- ❌ `event_name == "api_request"` (incorrect)
- ✅ `name == "api_request"` (correct)

The `name` property is the event's name field in the ingestion payload.

## Decision

### Use Token-Based Metering Instead of Request Count

**Chosen approach**: Track consumed tokens, not API request count.

**Rationale**:
1. **Accuracy**: Token consumption better reflects actual resource usage for LLM services
2. **Flexibility**: Different operations consume different amounts of tokens
3. **Industry standard**: Aligns with how LLM providers (OpenAI, Anthropic) bill customers
4. **Fairer billing**: Users who make efficient queries aren't penalized vs those making wasteful ones

### Implementation Plan

#### Meter Configuration

```
Name: "Consumed Tokens"
Filter: name == "token_consumption"
Aggregation: sum (over "totalTokens" property in metadata)
```

#### Event Ingestion

When processing LLM requests, ingest events using the Polar SDK's `LLMMetadata` type:

```json
{
  "name": "token_consumption",
  "externalCustomerId": "<external_customer_id>",
  "metadata": {
    "vendor": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "inputTokens": 500,
    "outputTokens": 1000,
    "totalTokens": 1500,
    "cachedInputTokens": 100
  }
}
```

#### Benefits per Plan

| Plan | Monthly Token Allowance |
|------|------------------------|
| Free | 10,000 tokens/month |
| Pro | 100,000 tokens/month |
| Team | Unlimited (or very high cap) |

#### Rollover Setting

Set `rollover: false` — unused tokens do not carry over to the next month. This simplifies capacity planning and encourages regular usage.

## Migration Steps

1. Create new meter "Consumed Tokens" with filter `name == "token_consumption"` and aggregation `sum` over `tokens`
2. Create new `meter_credit` benefits for each plan with appropriate token amounts
3. Update products to use the new benefits
4. Archive the old "API Requests" meter and associated benefits
5. Update application code to ingest token consumption events

## References

- [Polar.sh Credits Documentation](https://polar.sh/docs/features/usage-based-billing/credits)
- [Polar.sh Meters Documentation](https://polar.sh/docs/features/usage-based-billing/meters)
- [billing.md](./billing.md) — Original billing system decision
