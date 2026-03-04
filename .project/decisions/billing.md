# Billing system selection

## Requirements

- Before account creation: 3 free uses
- After account creation: 10 free uses per month
- Higher plans increase usage/input size limits
- No usage-based billing required

## Comparison

| Item | Stripe | Polar.sh |
|------|--------|----------|
| Fees | 2.9% + 30¢ | 4% + 40¢ |
| Tax handling | Your responsibility | MoR (included) |
| Integration difficulty | Medium–High | Low (integrate in 6 lines) |
| Subscriptions | Feature-rich | Simple |
| Usage-based billing | Supported | Supported |
| Open source | No | Yes |

## Recommendation: Polar.sh

Reasons:
1. **Merchant of Record** — Polar handles taxes (VAT, sales tax, etc.), reducing the burden for global expansion
2. **Simple pricing** — fits Ultrahope’s “limits change per plan” model
3. **Developer experience** — easy to integrate with Next.js/ElysiaJS; doable in 6 lines
4. **Fee difference is acceptable** — the 1.1% + 10¢ delta is worth it given MoR services

## Implementation approach

1. Plan design:
   - Free: 10 uses/month, input size limited
   - Pro ($X/month): 100 uses/month, relaxed input size limits
   - Team ($Y/month): Unlimited

2. For unauthenticated users, enforce the 3-use limit in the API via IP or device ID

3. Implement checkout and customer portal with the Polar SDK

## References

- https://polar.sh/docs
- https://polar.sh/resources/comparison/stripe
