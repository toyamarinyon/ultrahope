# Auto-create Free Subscription on Sign-up

## Context

The Polar plugin creates a Polar customer automatically on sign-up, but no subscription was attached.
This meant the Pricing page triggered a checkout flow even for the Free plan, resulting in poor UX.

## Decision

Automatically create a Free plan subscription via Polar API when a user signs up.

## Implementation

Used Better Auth's `databaseHooks.user.create.after` hook to:
1. Check existing subscriptions via `customers.getStateExternal` (idempotency)
2. Create Free subscription via `subscriptions.create` if not present

```typescript
// packages/web/src/lib/auth.ts
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        const customerState = await polarClient.customers.getStateExternal({
          externalId: user.id,
        });
        if (customerState.activeSubscriptions.some(s => s.productId === freeProductId)) {
          return; // already exists
        }
        await polarClient.subscriptions.create({
          productId: freeProductId,
          externalCustomerId: user.id,
        });
      },
    },
  },
},
```

## Required OAT Scopes

Added to the existing token:
- `customers:read` — idempotency check
- `subscriptions:write` — create subscription

See [docs/polar/oat.md](../docs/polar/oat.md) for full scope list.

## Notes

- `POST /v1/subscriptions/` only works for free products; paid plans must use checkout flow.
- No order or confirmation email is created by Polar for this endpoint.
