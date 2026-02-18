# Auth Flow Monitoring Runbook

## Overview

Incident response procedures for authentication flows (GitHub OAuth / Email Sign-in / Sign-up / Password Reset).

## Routine Monitoring

Routine health checks are automated by the `checking-auth-health` agent skill.
Ask the agent to "check auth health" — it will fetch and analyze production logs via `vercel logs` CLI.

See: `.agents/skills/checking-auth-health/SKILL.md`

## Incident Response

### GitHub OAuth not working

1. **Verify**: Check [GitHub Status](https://www.githubstatus.com/) for outages
2. **Blast radius**: Email/Password login is independent and unaffected
3. **Response**: Wait for GitHub recovery. Direct users to Email/Password login
4. **Env check**: Verify `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` are set correctly

### Email/Password login not working

1. **Verify**: Check Runtime Logs for errors on `action: "sign-in/email"`
2. **DB check**: Verify Turso/LibSQL connection status
3. **Response**: Attempt a redeploy if DB connection errors are found

### Password reset emails not delivered

1. **Verify**: Check Runtime Logs for errors on `action: "forget-password"`
2. **Resend check**: Check delivery status on [Resend Dashboard](https://resend.com/)
3. **Env check**: Verify `RESEND_API_KEY` / `EMAIL_FROM` are set correctly

### All auth flows down

1. **Vercel status**: Check [Vercel Status](https://www.vercel-status.com/)
2. **Deploy check**: Review recent deploys for auth-related changes
3. **Env check**: Verify auth-related environment variables in Vercel Dashboard > Settings > Environment Variables
4. **Rollback**: Use Instant Rollback to revert the problematic deploy

## Environment Variable Checklist

Required environment variables for auth flows:

- `GITHUB_CLIENT_ID` — GitHub OAuth
- `GITHUB_CLIENT_SECRET` — GitHub OAuth
- `RESEND_API_KEY` — Password reset email delivery
- `EMAIL_FROM` — Sender address for emails
- `POLAR_PRODUCT_FREE_ID` — Free plan assignment on account creation
- `POLAR_ACCESS_TOKEN` — Polar API
- `POLAR_WEBHOOK_SECRET` — Polar webhook verification
