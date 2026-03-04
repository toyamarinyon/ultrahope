# Free Plan Daily Limit

## Status

Accepted

## Context

The current Free plan grants $0.40/month in credits via Polar's `meter_credit` benefit. This approach has issues:

- Users can exhaust credits early in the month → month-long lockout → churn risk
- New users joining mid-month get less value
- Credit-based model is complex for a "try the product" tier

## Decision

Replace credit-based limit with **5 requests per day**, resetting at **00:00 UTC**.

### Why daily limit over monthly?

| Approach | Pros | Cons |
|----------|------|------|
| Monthly 150 requests | Works with Polar meter | Burst usage → month-long lockout |
| Daily 5 requests | Habit formation, daily engagement | Requires custom implementation |

Daily limit wins for product goals:
1. **Habit formation** — Users can engage every day
2. **Reduced churn** — "Try again tomorrow" vs "wait until next month"
3. **Upgrade motivation** — Hitting limit daily creates natural upgrade pressure
4. **Fairness** — New users get same experience regardless of signup date

### Why UTC?

- Simple implementation (no user timezone storage)
- Common practice for developer tools
- Display local time in UI: "Resets at 00:00 UTC (09:00 JST)"

## Implementation

### Storage (Turso)

```sql
CREATE TABLE daily_usage (
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,  -- 'YYYY-MM-DD' in UTC
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
```

No cron/reset job needed — each day is a new key. Old records can be cleaned up periodically:

```sql
DELETE FROM daily_usage WHERE date < date('now', '-7 days');
```

### API Changes

1. **Check daily usage** before processing request (Free plan only)
2. **Increment count** on successful request
3. **Return 402** when limit exceeded, with:
   - `reason: "daily_limit_exceeded"`
   - `resetsAt: "2026-01-29T00:00:00Z"`
   - `upgradeUrl: "/pricing"`

### Polar Changes

- Remove `free_credits` benefit from Free product
- Keep Free plan subscription for plan identification (Free vs Pro)

### UI Changes

- Pricing page: "$0" → "5 requests/day"
- Usage display: Show remaining requests + reset time in user's timezone
- 402 error page: "Daily limit reached. Resets at {localTime}. Upgrade to Pro for unlimited."

## Consequences

- **Pro**: Better user engagement, clearer value prop, simpler mental model
- **Con**: Custom implementation instead of Polar-native, but minimal complexity (single table + count check)
