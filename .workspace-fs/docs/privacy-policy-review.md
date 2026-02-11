# Privacy Policy Review

**Date:** 2026-02-11
**File reviewed:** `packages/web/public/privacy/pivacy.md`

## Accurate Sections

- CLI + Web API dual-component description (Introduction)
- Core functionality: sending git diffs to third-party LLM providers for commit message generation
- Personal information collected: name, email, username, authentication data
- Payment processing delegated to Polar
- Social login via GitHub OAuth
- Section 15: user-submitted content processed by AI
- Servers located in the US (Vercel hosting)

## Issues Found

### HIGH Priority

#### 1. Section 15 contradicts actual data storage

**Policy states:** Content is not stored beyond the duration of the request.

**Reality:** The `commandExecution` table persists the full request payload (including diffs), and the `generation` table stores complete AI output. No automatic cleanup mechanism exists in the codebase.

**Action:** Either disclose that data is stored and specify a retention period, or implement code to delete payloads after processing.

#### 2. AI provider list is inaccurate (Section 6)

**Policy states:** Cerebras, OpenAI, xAI, Mistral AI.

**Reality:** Current default models are `mistral/ministral-3b` and `xai/grok-code-fast-1`, routed through Vercel AI Gateway. Providers change over time—hardcoding them in a legal document will cause recurring drift.

**Action:** Replace the fixed list with a reference to a `/models` page that can be updated alongside code deployments.

#### 3. Collected data is under-disclosed (Section 1)

**Policy lists:** IP address, browser info, device info (standard log data).

**Actually collected but not disclosed:**
- CLI session ID and command arguments
- Full request payload (git diffs sent for processing)
- Full AI-generated output (commit messages, PR titles)
- Generation cost in microdollars
- User feedback score (1–5)
- IP address and User-Agent persisted in the `session` database table

**Action:** Add these to the "Automatically Collected Information" or "Information Collected During Service Use" sections.

### MEDIUM Priority

#### 4. Resend (email service) not disclosed

**Reality:** Resend sends password-reset and magic-link emails. User email addresses are shared with Resend.

**Action:** List Resend as a third-party service provider.

#### 5. Vercel not disclosed

**Reality:** The application is hosted on Vercel, and Vercel AI Gateway routes all LLM requests.

**Action:** List Vercel under "Website Hosting Service Providers" and "AI Platforms."

#### 6. Cookie / tracking section overstates reality (Section 5)

**Policy states:** Third-party advertising tracking technologies are permitted; mentions targeted advertising.

**Reality:** No third-party analytics (Google Analytics, Sentry, Mixpanel, etc.) or ad trackers are present in the codebase. The only cookies are Better-Auth session cookies.

**Action:** Remove references to targeted advertising and third-party tracking that do not exist.

#### 7. Polar usage-data sharing under-specified (Section 4)

**Policy states:** Data shared with "Payment Processors" (generic).

**Reality:** Every generation event sends cost, model name, provider name, generation ID, and customer ID to Polar for metered billing.

**Action:** Specify what usage data is shared with Polar.

### LOW Priority

#### 8. Data retention is vague (Section 9)

**Policy states:** "As long as you have an account."

**Reality:** No automated data cleanup exists (except device-code and email-verification token expiry). No concrete retention schedule is defined.

**Action:** Define a retention policy and implement automated cleanup, or be explicit that data is retained indefinitely.

#### 9. Data deletion / export not implemented

**Policy states (Section 18):** Users can request data review, update, and deletion via GitHub Issues.

**Reality:** No data-deletion or data-export API endpoint or admin tool exists.

**Action:** Implement a deletion workflow to back the policy promise, especially for GDPR/CCPA compliance.

#### 10. Database region not disclosed

**Policy states:** Servers in the United States.

**Reality:** Turso database is in AWS Tokyo (ap-northeast-1).

**Action:** Add Japan to Section 8 (International Transfers) as a data-storage location.

## Summary

| Priority | # | Issue |
|----------|---|-------|
| HIGH | 1 | Section 15 says data isn't stored — it is |
| HIGH | 2 | AI provider list is hardcoded and inaccurate |
| HIGH | 3 | Collected data significantly under-disclosed |
| MEDIUM | 4 | Resend not listed as third-party provider |
| MEDIUM | 5 | Vercel not listed as third-party provider |
| MEDIUM | 6 | Cookie/tracking section overstates reality |
| MEDIUM | 7 | Polar data sharing under-specified |
| LOW | 8 | Data retention policy is vague |
| LOW | 9 | Data deletion/export not implemented |
| LOW | 10 | Database region (Japan) not disclosed |
