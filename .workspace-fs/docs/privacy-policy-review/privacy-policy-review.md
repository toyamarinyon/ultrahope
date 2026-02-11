# Privacy Policy Review

**Date:** 2026-02-11
**File reviewed:** `packages/web/public/privacy/pivacy.md`
**Status:** 🔴 In Progress

## Progress

| Priority | # | Issue | Status |
|----------|---|-------|--------|
| HIGH | 1 | Section 15 says data isn't stored — it is | ⬜ TODO |
| HIGH | 2 | AI provider list is hardcoded and inaccurate | ⬜ TODO |
| HIGH | 3 | Collected data significantly under-disclosed | ⬜ TODO |
| MEDIUM | 4 | Resend not listed as third-party provider | ⬜ TODO |
| MEDIUM | 5 | Vercel not listed as third-party provider | ⬜ TODO |
| MEDIUM | 6 | Cookie/tracking section overstates reality | ⬜ TODO |
| MEDIUM | 7 | Polar data sharing under-specified | ⬜ TODO |
| LOW | 8 | Data retention policy is vague | ⬜ TODO |
| LOW | 9 | Data deletion/export not implemented | ⬜ TODO |
| LOW | 10 | Database region (Japan) not disclosed | ⬜ TODO |

> Status: ⬜ TODO / 🔧 IN PROGRESS / ✅ DONE / ⏭️ DEFERRED

---

## Accurate Sections (No Action Needed)

- CLI + Web API dual-component description (Introduction)
- Core functionality: sending git diffs to third-party LLM providers for commit message generation
- Personal information collected: name, email, username, authentication data
- Payment processing delegated to Polar
- Social login via GitHub OAuth
- Section 15: user-submitted content processed by AI
- Servers located in the US (Vercel hosting)

---

## Issues

### HIGH Priority

#### 1. Section 15 contradicts actual data storage — ⬜ TODO

**Policy states:** Content is not stored beyond the duration of the request.

**Reality:** The `commandExecution` table persists the full request payload (including diffs), and the `generation` table stores complete AI output. No automatic cleanup mechanism exists in the codebase.

**Action:** Either disclose that data is stored and specify a retention period, or implement code to delete payloads after processing.

**Resolution:**
<!-- Record what was done here -->

---

#### 2. AI provider list is inaccurate (Section 6) — ⬜ TODO

**Policy states:** Cerebras, OpenAI, xAI, Mistral AI.

**Reality:** Current default models are `mistral/ministral-3b` and `xai/grok-code-fast-1`, routed through Vercel AI Gateway. Providers change over time—hardcoding them in a legal document will cause recurring drift.

**Action:** Replace the fixed list with a reference to a `/models` page that can be updated alongside code deployments.

**Resolution:**
<!-- Record what was done here -->

---

#### 3. Collected data is under-disclosed (Section 1) — ⬜ TODO

**Policy lists:** IP address, browser info, device info (standard log data).

**Actually collected but not disclosed:**
- CLI session ID and command arguments
- Full request payload (git diffs sent for processing)
- Full AI-generated output (commit messages, PR titles)
- Generation cost in microdollars
- User feedback score (1–5)
- IP address and User-Agent persisted in the `session` database table

**Action:** Add these to the "Automatically Collected Information" or "Information Collected During Service Use" sections.

**Resolution:**
<!-- Record what was done here -->

---

### MEDIUM Priority

#### 4. Resend (email service) not disclosed — ⬜ TODO

**Reality:** Resend sends password-reset and magic-link emails. User email addresses are shared with Resend.

**Action:** List Resend as a third-party service provider.

**Resolution:**
<!-- Record what was done here -->

---

#### 5. Vercel not disclosed — ⬜ TODO

**Reality:** The application is hosted on Vercel, and Vercel AI Gateway routes all LLM requests.

**Action:** List Vercel under "Website Hosting Service Providers" and "AI Platforms."

**Resolution:**
<!-- Record what was done here -->

---

#### 6. Cookie / tracking section overstates reality (Section 5) — ⬜ TODO

**Policy states:** Third-party advertising tracking technologies are permitted; mentions targeted advertising.

**Reality:** No third-party analytics (Google Analytics, Sentry, Mixpanel, etc.) or ad trackers are present in the codebase. The only cookies are Better-Auth session cookies.

**Action:** Remove references to targeted advertising and third-party tracking that do not exist.

**Resolution:**
<!-- Record what was done here -->

---

#### 7. Polar usage-data sharing under-specified (Section 4) — ⬜ TODO

**Policy states:** Data shared with "Payment Processors" (generic).

**Reality:** Every generation event sends cost, model name, provider name, generation ID, and customer ID to Polar for metered billing.

**Action:** Specify what usage data is shared with Polar.

**Resolution:**
<!-- Record what was done here -->

---

### LOW Priority

#### 8. Data retention is vague (Section 9) — ⬜ TODO

**Policy states:** "As long as you have an account."

**Reality:** No automated data cleanup exists (except device-code and email-verification token expiry). No concrete retention schedule is defined.

**Action:** Define a retention policy and implement automated cleanup, or be explicit that data is retained indefinitely.

**Resolution:**
<!-- Record what was done here -->

---

#### 9. Data deletion / export not implemented — ⬜ TODO

**Policy states (Section 18):** Users can request data review, update, and deletion via GitHub Issues.

**Reality:** No data-deletion or data-export API endpoint or admin tool exists.

**Action:** Implement a deletion workflow to back the policy promise, especially for GDPR/CCPA compliance.

**Resolution:**
<!-- Record what was done here -->

---

#### 10. Database region not disclosed — ⬜ TODO

**Policy states:** Servers in the United States.

**Reality:** Turso database is in AWS Tokyo (ap-northeast-1).

**Action:** Add Japan to Section 8 (International Transfers) as a data-storage location.

**Resolution:**
<!-- Record what was done here -->
