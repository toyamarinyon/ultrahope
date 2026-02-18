---
name: checking-auth-health
description: Checks auth flow health using Vercel CLI logs. Use when asked to check auth health, review auth errors, monitor login/signup issues, or diagnose authentication problems.
---

# Auth Flow Health Check

Analyze authentication endpoint health using `vercel logs` CLI and the structured JSON logs emitted by the auth route handler.

## Prerequisites

- Vercel CLI installed and authenticated (`vercel login`)
- Project linked (`vercel link`)
- Environment variable `VERCEL_TOKEN` available if running non-interactively: `eval "$(mise -E amp env)"`

## Workflow

### 1. Fetch auth error logs

```bash
vercel logs --environment production --query '"tag":"auth"' --level error --since 7d --json --limit 100
```

If the output is empty, auth is healthy. Report that and stop.

### 2. Parse and summarize

Pipe to `jq` to extract structured auth log entries:

```bash
vercel logs --environment production --query '"tag":"auth"' --level error --since 7d --json --limit 100 \
  | jq -r 'select(.message) | .message' \
  | jq -s 'group_by(.action) | map({action: .[0].action, count: length, statuses: (map(.status) | unique), avg_duration: ((map(.duration // 0) | add) / length | round)})'
```

This produces a summary grouped by auth action (e.g. `sign-in/email`, `sign-up/email`, `callback/github`).

### 3. Check for 5xx spikes

```bash
vercel logs --environment production --status-code 5xx --since 7d --json --limit 100 \
  | jq -r 'select(.message) | .message' \
  | jq -s 'map(select(.tag == "auth"))'
```

5xx errors indicate server-side failures that need immediate attention.

### 4. Trace a specific failure

Use `correlationId` from step 2 to find the full request/response pair:

```bash
vercel logs --environment production --query '<correlationId>' --json
```

### 5. Report

Present findings in this format:

```
## Auth Health Report (<date range>)

| Action | Errors | Status Codes | Avg Duration |
|--------|--------|-------------|-------------|
| sign-in/email | 3 | 401 | 120ms |
| ... | ... | ... | ... |

### Issues Found
- <description and correlationId>

### Recommendation
- <action items or "No issues found">
```

## Log Structure Reference

The canonical log structure is defined as TypeScript types in `packages/web/lib/auth-log.ts`.
Read that file to understand the exact fields and their types before parsing logs.

### Key fields

- `tag`: Always `"auth"`
- `event`: `"request"` | `"response"` | `"exception"`
- `correlationId`: UUID linking request/response pairs
- `action`: Auth action path (e.g. `sign-in/email`, `sign-up/email`, `callback/github`, `forget-password`, `reset-password`, `get-session`)
- `status`: HTTP status code (response only)
- `duration`: Response time in ms (response/exception only)
- `error`: Error message (exception only)

## Decision Criteria

| Error Rate | Status | Action |
|-----------|--------|--------|
| 0 errors | Healthy | Report clean |
| < 5% | Normal | Note in report, no action needed |
| 5–15% | Warning | Flag for investigation, check runbook |
| > 15% | Critical | Escalate, reference `.workspace-fs/docs/auth-monitoring-runbook.md` |

## Related

- Operational runbook: `.workspace-fs/docs/auth-monitoring-runbook.md`
- Auth route handler: `packages/web/app/api/auth/[[...all]]/route.ts`
- Auth config: `packages/web/lib/auth.ts`
