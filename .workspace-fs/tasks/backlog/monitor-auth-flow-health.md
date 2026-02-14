# Add auth flow monitoring and recovery checks

Owner: satoshi

Context:
- Release readiness requires confidence in GitHub OAuth, email/password sign-in, account creation, and password reset.

Acceptance criteria:
- Add basic monitoring/alerts for auth endpoint failures and exception spikes.
- Track conversion failures for sign-in and password-reset requests.
- Add manual runbook for recovery on provider/login outages.
- Verify logs include correlation IDs for failed login/signup events.

Next action:
- Define SLO/alerts and add lightweight dashboard checks for the four key auth routes.
