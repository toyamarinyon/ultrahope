# Privacy Policy Review

**Date:** 2026-02-12
**File reviewed:** `packages/web/app/privacy/privacy.md`
**Status:** 🟡 In Progress

## Progress

| Priority | # | Issue | Status |
|----------|---|-------|--------|
| CRITICAL | 1 | Section 18 is misleading (実装と記載が異なる) | ✅ DONE |
| HIGH | 2 | Better-Auth not listed as third-party service | ✅ DONE (Not an issue) |
| HIGH | 3 | Data export not implemented | ✅ DONE (Documented manual process) |
| HIGH | 4 | Sections 6 and 15 duplicate AI processing | ✅ DONE |
| MEDIUM | 5 | IP/User-Agent recording unclear | ✅ DONE |
| MEDIUM | 6 | Security measures too vague | ✅ DONE |
| MEDIUM | 7 | Backup retention period unclear | ✅ DONE |
| MEDIUM | 8 | "Communication & Collaboration Tools" unclear | ⬜ TODO |
| MEDIUM | 9 | "Social Networks" unclear | ⬜ TODO |
| LOW | 10 | Document too long (535 lines) | ⬜ TODO |
| LOW | 11 | "may" overuse creates ambiguity | ⬜ TODO |
| LOW | 12 | Passive voice overuse | ⬜ TODO |

> Status: ⬜ TODO / 🔧 IN PROGRESS / ✅ DONE / ⏭️ DEFERRED

---

## Accurate Sections (No Action Needed)

- ✅ Data collection categories well-documented (Section 1)
- ✅ AI processing transparency (mentions Vercel AI Gateway)
- ✅ No model training commitment clearly stated
- ✅ Polar data sharing highly detailed (Section 4)
- ✅ No third-party analytics/tracking (Section 5)
- ✅ Cookie usage accurate (Better-Auth session cookies only)
- ✅ Self-service account deletion implemented
- ✅ `/models` page exists and is accurate
- ✅ International data transfer disclosure (Section 8)
- ✅ GDPR/CCPA rights documented (Sections 12, 14)

---

## Developer Experience Scores

| Category | Score | Weight | Notes |
|----------|-------|--------|-------|
| Overall Structure & Readability | 7.5/10 | 10% | Too long (535 lines), US state laws overly detailed |
| Information Collection Transparency | 8.5/10 | 20% | Excellent detail; IP/User-Agent wording now aligned with implementation |
| AI Processing Explanation | 7.0/10 | 15% | Transparency is good; Section 6 now serves as the canonical explanation |
| Third-Party Sharing Clarity | 6.5/10 | 15% | Polar very detailed; remaining clarity issues are category wording |
| Data Retention & Security | 7.0/10 | 15% | Retention tradeoffs are explicit and security controls are now concrete |
| User Rights | 6.0/10 | 15% | Deletion easy, but no export yet |
| Tone & Language | 5.0/10 | 5% | Too much legal boilerplate, passive voice |
| Technical Accuracy | 8.0/10 | 5% | Implementation mostly matches policy; follow-up items remain |

**Overall Developer Score: 7.08/10**

**Target Score (after fixes): 8.5-9.0/10**

---

## Implementation Alignment

### ✅ Verified Correct

1. **Session Data**: CLI session ID collected (`commandExecution.cliSessionId`)
2. **Request Payload**: Full diffs stored (`commandExecution.requestPayload`)
3. **Generated Output**: AI text stored (`generation.output`)
4. **Usage Metadata**: Model, provider, cost, timestamps all stored
5. **User Feedback**: 1-5 scores stored (`generationScore.value`)
6. **Vercel AI Gateway**: Used for all LLM requests
7. **Turso**: Database storage confirmed
8. **Polar**: Metered billing with detailed data sharing
9. **Resend**: Email service for password reset
10. **GitHub OAuth**: Social login implementation
11. **No third-party tracking**: No Google Analytics, Sentry, Mixpanel, etc.
12. **Account deletion**: Self-service from Settings page

### ⚠️ Needs Verification/Correction

- None at this time (for previously identified medium-priority accuracy items).

---

## Comparison to Other Developer Tools

### Good Examples (Concise & Clear)

**Linear:**
> "We store your data on AWS in us-east-1. We use Postgres with daily backups. We delete data 30 days after account deletion."

**Raycast:**
> "We don't track you. No analytics, no ads, no bullshit."

### Ultrahope Current State

- ✅ Good: Data collection transparency
- ✅ Good: No tracking/analytics
- ⚠️ Needs improvement: Too verbose (535 lines vs. typical 200-300)
- ⚠️ Needs improvement: Legal boilerplate heavy
- ⚠️ Needs improvement: Overall length and legal boilerplate remain high

---

## Recommended Action Plan

### Phase 1: Critical Fixes (1-2 days)

1. Fix Section 18 (misleading deletion instructions) ✅ Done (2026-02-12)
2. Better-Auth listing reviewed and closed as Not an issue ✅ Done (2026-02-12)
3. Verify IP/User-Agent recording ✅ Done (2026-02-12)
4. Clarify backup handling policy ✅ Done (2026-02-12) — currently no backup archives are operated for user data

### Phase 2: High Priority (1-2 weeks)

5. Merge Sections 6 & 15 (eliminate duplication) ✅ Done (2026-02-12)
6. Add specific security measures (implementation-backed) ✅ Done (2026-02-12)
7. Implement self-service data export (policy already clarifies current manual process)
8. Add table format for third-party services

### Phase 3: Polish (1-2 months)

9. Reduce length to 300-350 lines
10. Move US state laws to Appendix
11. Convert passive voice to active voice
12. Replace "may" with "do/don't"

---

## References

- Previous review: `.workspace-fs/docs/privacy-policy-review/`
- Implementation analysis: Agent aabae4f (2026-02-12)
- Privacy policy: `packages/web/app/privacy/privacy.md`
- Terms of use review: `.workspace-fs/docs/terms-of-use-review/FINAL-REPORT.md`
