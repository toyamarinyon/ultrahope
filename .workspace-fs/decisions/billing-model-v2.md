# Billing Model v2: Subscription + Included Credit

## Context

With multi-model generation support, we needed to revisit billing. Different models have different costs, and we needed a fair, transparent pricing model.

## Decision

Adopt a **Zed-style** billing model: subscription fee + included usage credit, then actual cost with no markup.

## Pricing Structure

| Plan | Monthly Fee | Included Credit | Overage |
|------|-------------|-----------------|---------|
| Free | $0 | $0.40 | N/A (hard cap) |
| Pro | $10 | $5 | Actual cost, no markup |

## Rationale

### Why not pure usage-based?
- "$X in = $X out" problem — no margin, unsustainable
- Users see us as a pass-through, not a product

### Why not hidden markup on tokens?
- Feels dishonest
- Hard to explain pricing
- Users can compare to provider pricing and feel cheated

### Why subscription + included credit?
- **Clear value prop**: subscription pays for the product experience (UX, orchestration, multi-candidate generation, fallback, safety, time saved)
- **Honest overage**: actual cost, no markup — users trust us
- **Predictable for most users**: included credit covers typical usage
- **Sustainable**: subscription fee covers operating costs

## Implementation

### Cost Tracking via Vercel AI Gateway

Vercel AI Gateway provides `total_cost` in USD per generation:

```json
{
  "data": {
    "id": "gen_01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "total_cost": 0.00123,
    "model": "gpt-4",
    "provider_name": "openai"
  }
}
```

### Flow

```
1. User makes request → Ultrahope API → Vercel AI Gateway
2. AI Gateway returns response with generation_id
3. Lookup generation: GET /generation?id={id} → { total_cost }
4. Deduct total_cost from user's credit balance (Polar.sh)
```

### Advantages

- **No pricing table maintenance**: Vercel handles per-model pricing
- **Automatic price updates**: When providers change pricing, it's reflected automatically
- **Accurate cost**: Input/output/cached/reasoning tokens all accounted for

### Microdollars Unit

Polar.sh meter credits use integers, but AI costs are sub-cent (e.g., `$0.00123`). We use **microdollars** (1 USD = 1,000,000 units) to maintain precision:

| Value | USD | Microdollars |
|-------|-----|--------------|
| Free credit | $0.40 | 400,000 |
| Pro credit | $5.00 | 5,000,000 |
| Typical generation | $0.00123 | 1,230 |

**Why not cents?** A $0.00123 generation = 0.123 cents — still a float. Microdollars ensure all values are clean integers.

## Migration from Token-Based Billing

Previous model used token counts with Polar.sh meters. New model:

| Before | After |
|--------|-------|
| Credits = tokens | Credits = microdollars |
| Free: 400K tokens | Free: 400K microdollars ($0.40) |
| Pro: 1M tokens | Pro: 5M microdollars ($5.00) |
| Meter: sum of totalTokens | Meter: sum of cost (microdollars) |

### Polar.sh Changes

Meters cannot be updated once they have processed events. Migration strategy:

1. **Create new** "Usage Cost" meter (filter: `name == "usage"`, sum over `cost`)
2. **Create new** benefits with microdollar amounts
3. **Update products** to use new benefits (takes effect at next billing cycle)
4. **Archive old** meter/benefits manually after migration complete

Event ingestion format:

```json
{
  "name": "usage",
  "externalCustomerId": "<user_id>",
  "metadata": {
    "cost": 1230,
    "model": "gpt-4",
    "provider": "openai",
    "generationId": "gen_01ARZ3NDEKTSV4RRFFQ69G5FAV"
  }
}
```

Note: `cost = total_cost * 1_000_000` (convert USD to microdollars)

### Sync Script

Configuration is managed via `scripts/polar-sync.ts`:

```bash
# Preview changes
pnpm -w exec tsx scripts/polar-sync.ts --dry-run

# Apply to sandbox
pnpm -w exec tsx scripts/polar-sync.ts

# Apply to production
pnpm -w exec tsx scripts/polar-sync.ts --production
```

## Credit Top-up & Auto-Recharge

### Design Decision: No Automatic Metered Overage

We explicitly chose **not** to use Polar.sh's automatic metered billing on Pro:
- Users should have explicit control over spending
- Avoids surprise charges
- One-time credit purchases give clear "I'm buying $X more" UX

### Credit Top-up Products

Pro users can purchase additional credits when balance is low:

| Product | Price | Credit Added |
|---------|-------|--------------|
| Credit $10 | $10 | 10,000,000 microdollars ($10) |
| Credit $20 | $20 | 20,000,000 microdollars ($20) |

These are one-time purchases (no `recurringInterval`). Credits from top-ups **roll over** (unlike subscription credits).

### Auto-Recharge Feature

Users can enable auto-recharge to avoid interruptions:

| Setting | Description |
|---------|-------------|
| `autoRecharge.enabled` | Enable/disable auto-recharge (default: false) |
| `autoRecharge.threshold` | Balance threshold to trigger recharge (default: 1,000,000 = $1) |
| `autoRecharge.amount` | Amount to recharge: 10 or 20 (maps to Credit $10 or $20 product) |

**Flow:**
1. After each usage event, check if balance ≤ threshold
2. If auto-recharge enabled and balance below threshold → create checkout for the selected credit product
3. Polar.sh processes payment → webhook grants credits

### 402 Response Structure

When credits are exhausted, return a structured 402 response with actionable links.

**Location:** `packages/web/src/app/api/[[...slugs]]/route.ts`

**Pro user:**
```json
{
  "error": "insufficient_balance",
  "message": "Your usage credit has been exhausted.",
  "balance": 0,
  "plan": "pro",
  "actions": {
    "buyCredits": "https://ultrahope.dev/settings/billing#credits",
    "enableAutoRecharge": "https://ultrahope.dev/settings/billing#auto-recharge"
  },
  "hint": "Purchase additional credits or enable auto-recharge to continue."
}
```

**Free user:**
```json
{
  "error": "insufficient_balance",
  "message": "Your free credit has been exhausted.",
  "balance": 0,
  "plan": "free",
  "actions": {
    "upgrade": "https://ultrahope.dev/pricing"
  },
  "hint": "Upgrade to Pro for $10/month with $5 included credit and one-time credit purchases."
}
```

### Polar.sh Setup

**Products:**
- Free: free price, $0.40 credit benefit (no rollover)
- Pro: $10/month fixed price, $5 credit benefit (no rollover), **no metered price**
- Credit $10: $10 one-time, $10 credit benefit (rollover: true)
- Credit $20: $20 one-time, $20 credit benefit (rollover: true)

## References

- [Zed pricing](https://zed.dev/pricing) — inspiration for this model
- [Vercel AI Gateway Usage docs](llms-furl/vercel.com/docs/ai-gateway/capabilities/usage.md)
- [billing-meter-design.md](billing-meter-design.md) — previous token-based design
