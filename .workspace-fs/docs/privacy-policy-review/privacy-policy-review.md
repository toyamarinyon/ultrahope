# Privacy Policy Review

**Date:** 2026-02-11
**File reviewed:** `packages/web/app/privacy/privacy.md`
**Status:** 🔴 In Progress

## Progress

| Priority | # | Issue | Status |
|----------|---|-------|--------|
| HIGH | 1 | Section 15 says data isn't stored — it is | ✅ DONE |
| HIGH | 2 | AI provider list is hardcoded and inaccurate | ✅ DONE |
| HIGH | 3 | Collected data significantly under-disclosed | ✅ DONE |
| MEDIUM | 4 | Resend not listed as third-party provider | ✅ DONE |
| MEDIUM | 5 | Vercel not listed as third-party provider | ✅ DONE |
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

#### 1. Section 15 contradicts actual data storage — ✅ DONE

**Policy states:** Content is not stored beyond the duration of the request.

**Reality:** The `commandExecution` table persists the full request payload (including diffs), and the `generation` table stores complete AI output. No automatic cleanup mechanism exists in the codebase.

**Action:** Either disclose that data is stored and specify a retention period, or implement code to delete payloads after processing.

**Resolution:**
Rewrote Section 15 to disclose that submitted content and generated output are stored. Stated that data is retained so users can review past results and reprocess with different models/settings, kept for the lifetime of the account, not used for model training or any other purpose, and deletable on request via Section 18.

---

#### 2. AI provider list is inaccurate (Section 6) — ✅ DONE

**Policy states:** Cerebras, OpenAI, xAI, Mistral AI.

**Reality:** Current default models are `mistral/ministral-3b` and `xai/grok-code-fast-1`, routed through Vercel AI Gateway. Providers change over time—hardcoding them in a legal document will cause recurring drift.

**Action:** Replace the fixed list with a reference to a `/models` page that can be updated alongside code deployments.

**Resolution:**
Replaced the hardcoded provider list in Section 6 with a reference to `https://ultrahope.dev/models`. Created `packages/web/app/models/page.tsx` listing current default models (`mistral/ministral-3b`, `xai/grok-code-fast-1`) with their providers, so the page can be updated alongside code deployments without touching the privacy policy.

---

#### 3. Collected data is under-disclosed (Section 1) — ✅ DONE

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
Added a new "Information collected during service use" subsection to Section 1. It discloses five categories of data: Session Data (CLI session ID, IP, User-Agent), Request Payload (diffs and command arguments), Generated Output (AI-generated text), Usage Metadata (model, provider, cost in microdollars, timestamps), and User Feedback (1–5 score). Framed consistently with Issue #1: data is stored so users can review past results and reprocess with different models/settings, not used for model training, deletable on request.

---

### MEDIUM Priority

#### 4. Resend (email service) not disclosed — ✅ DONE

**Reality:** Resend sends password-reset and magic-link emails. User email addresses are shared with Resend.

**Action:** List Resend as a third-party service provider.

**Resolution:**
Added "Email Service Providers" as a new category in the third-party sharing list in Section 4 of `packages/web/app/privacy/privacy.md`. This covers Resend, which processes user email addresses to deliver password-reset and magic-link emails on our behalf.

---

#### 5. Vercel not disclosed — ✅ DONE

**Reality:** The application is hosted on Vercel, and Vercel AI Gateway routes all LLM requests.

**Action:** List Vercel under "Website Hosting Service Providers" and "AI Platforms."

**Resolution:**
Added Vercel to the Section 4 third-party category list in two places: "AI Platforms" (as Vercel AI Gateway) and "Website Hosting Service Providers," each with a link to Vercel's privacy policy at https://vercel.com/legal/privacy-policy.

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
