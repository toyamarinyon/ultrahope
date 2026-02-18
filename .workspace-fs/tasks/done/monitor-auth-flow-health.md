# Add auth flow monitoring and recovery checks

Owner: satoshi

Context:
- Release readiness requires confidence in GitHub OAuth, email/password sign-in, account creation, and password reset.
- Using Vercel free plan only: Observability + Runtime Logs + server-side structured logging. No Pro plan features.

Acceptance criteria:
- [x] Add basic monitoring/alerts for auth endpoint failures and exception spikes.
  - Vercel Observability (free) enables checking `/api/auth` Error Rate and Duration on the Dashboard.
  - Added structured JSON log wrapper to `/api/auth/[[...all]]/route.ts`. All requests/responses include correlationId, action, status, and duration.
- [x] Track conversion failures for sign-in and password-reset requests.
  - Runtime Logs can be filtered by `action` field (`sign-in/email`, `forget-password`, etc.) and `status`.
  - Dedicated tracking via `@vercel/analytics` Custom Events deferred to Pro plan adoption. See `./.workspace-fs/tasks/backlog/auth-conversion-tracking.md`.
- [x] Add manual runbook for recovery on provider/login outages.
  - Created operational runbook at `./.workspace-fs/docs/auth-monitoring-runbook.md`.
  - Covers incident response for GitHub OAuth / Email login / Password reset / full outage scenarios.
- [x] Verify logs include correlation IDs for failed login/signup events.
  - All auth requests include a `randomUUID()` correlationId in structured logs.
  - Request → response/exception pairs are traceable by correlationId.

Artifacts:
- `packages/web/app/api/auth/[[...all]]/route.ts` — Structured log wrapper
- `./.workspace-fs/docs/auth-monitoring-runbook.md` — Operational runbook
- `.agents/skills/checking-auth-health/SKILL.md` — Agent skill for automated health checks via `vercel logs` CLI

Outcome:
- All acceptance criteria met within Vercel free plan constraints.
- Conversion tracking enhancement deferred to `./.workspace-fs/tasks/backlog/auth-conversion-tracking.md`.
