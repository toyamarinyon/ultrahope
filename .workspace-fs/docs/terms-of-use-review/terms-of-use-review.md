# Terms of Use Review

**Date:** 2026-02-11
**File reviewed:** `packages/web/app/terms/terms.md`
**Status:** 🟢 Complete

## Progress

| Priority | # | Issue | Status |
|----------|---|-------|--------|
| HIGH | [1](issues/01-section3-bans-automated-access.md) | Section 3 bans automated/bot access — contradicts CLI tool | ✅ DONE |
| HIGH | [2](issues/02-section4-bans-automated-use.md) | Section 4 bans automated use/scripts — contradicts CLI tool | ✅ DONE |
| HIGH | [3](issues/03-submissions-clause-ip-assignment.md) | "Submissions" clause implies IP assignment of user code | ✅ DONE |
| HIGH | [4](issues/04-section5-contradicts-itself.md) | Section 5 contradicts itself about user content | ✅ DONE |
| HIGH | [5](issues/05-no-ai-llm-disclaimers.md) | No mention of AI/LLM or disclaimers about generated content | ✅ DONE |
| MEDIUM | [6](issues/06-no-pricing-subscription-terms.md) | No pricing, subscription, or refund terms for a paid service | ✅ DONE |
| MEDIUM | [7](issues/07-no-cli-in-service-description.md) | Service description doesn't mention the CLI tool | ✅ DONE |
| MEDIUM | [8](issues/08-section4-bans-commercial-use.md) | Section 4 bans commercial use — contradicts Pro plan | ✅ DONE |
| MEDIUM | [9](issues/09-european-arbitration-chamber.md) | European Arbitration Chamber unusual for Japan-based company | ✅ DONE |
| LOW | [10](issues/10-no-api-rate-limits.md) | No mention of API rate limits or usage quotas | ✅ DONE |
| LOW | [11](issues/11-no-account-terms.md) | No account-related terms despite full auth system | ✅ DONE |

> Status: ⬜ TODO / 🔧 IN PROGRESS / ✅ DONE / ⏭️ DEFERRED

---

## Summary

Found **11 issues** where the Terms of Use diverge from the actual implementation:

### Critical Issues (HIGH Priority)

The most serious problems involve fundamental contradictions between the terms and the core service:

- **Issues #1-2:** The terms ban automated/bot access and scripts, but the CLI tool (the primary interface) is literally a script that makes automated API calls
- **Issue #3:** The "Submissions" clause could be read as assigning IP rights to user source code
- **Issue #4:** Section 5 contradicts itself about whether users can submit content
- **Issue #5:** No disclosure that the service uses AI/LLM or processes code through third-party AI providers

### Business Model Gaps (MEDIUM Priority)

- **Issue #6:** No mention of pricing, subscriptions, billing, refunds despite full payment system
- **Issue #7:** CLI tool not included in service definition
- **Issue #8:** Commercial use is prohibited, but Pro plan is sold for commercial use
- **Issue #9:** Belgian arbitration institution specified for Japan-based company

### Operational Details (LOW Priority)

- **Issue #10:** API rate limits and quotas not disclosed
- **Issue #11:** No account registration, security, or deletion terms

---

## Accurate Sections (No Action Needed)

- Company identity and contact information (Introduction, Section 19)
- Governing law: Japan, Kyoto courts (Section 10)
- General intellectual property ownership claims (Section 2, first part)
- Disclaimer and limitation of liability language (Sections 13, 14)
- Indemnification clause (Section 15)
- Electronic communications consent (Section 17)
- Miscellaneous boilerplate (Section 18)

---

## Next Steps

1. Review individual issue files in `issues/` directory
2. Prioritize HIGH issues for immediate resolution
3. Update `packages/web/app/terms/terms.md` based on recommendations
4. Mark issues as resolved in both issue files and this index

See [AGENTS.md](AGENTS.md) for detailed workflow instructions.
