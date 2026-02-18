# Add dedicated auth conversion tracking with @vercel/analytics

Owner: satoshi

Context:
- Basic auth monitoring is in place (structured logs with correlationId, action, status, duration).
- Runtime Logs filtering by `action` and `status` provides manual conversion tracking today.
- Upgrading to Vercel Pro plan unlocks `@vercel/analytics` Custom Events for automated, dashboard-level conversion tracking.

Related tasks:
- `./.workspace-fs/tasks/done/monitor-auth-flow-health.md` — Parent task that established the monitoring foundation.

Acceptance criteria:
- [ ] Integrate `@vercel/analytics` Custom Events for sign-in and password-reset conversion tracking.
- [ ] Track sign-in success/failure rates by provider (GitHub OAuth, email/password).
- [ ] Track password-reset request → completion conversion rate.
- [ ] Conversion metrics visible in Vercel Analytics dashboard.

Precondition:
- Vercel Pro plan adoption.

Next action:
- Evaluate when Pro plan adoption is planned and revisit this task at that time.
