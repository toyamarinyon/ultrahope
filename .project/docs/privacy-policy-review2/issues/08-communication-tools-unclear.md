# Issue #8: "Communication & Collaboration Tools" Unclear

**Priority:** 🟡 MEDIUM
**Category:** Third-Party Sharing
**Impact:** Unclear what this refers to
**Effort:** 2 minutes (if removing) OR 5 minutes (if specifying)
**Status:** ✅ DONE

---

## Problem (Original Assessment)

**Policy lists (Section 4, line 215):**
```markdown
- Communication & Collaboration Tools
```

**Issue:**
- No specific service named
- No implementation found in codebase
- Unclear what this refers to

**Developer Questions:**
- Slack? Discord? Teams?
- Email service? (Already covered by "Email Service Providers")
- Internal communication? (Unlikely to process user data)

---

## Investigation

### Search Results: No Communication Tools Found

**Codebase scan:**
- ❌ No Slack integration
- ❌ No Discord integration
- ❌ No Intercom, Crisp, or live chat
- ❌ No team collaboration features
- ✅ Only email service: Resend (already listed separately)

**Conclusion:**
This appears to be **template boilerplate** left in the policy but not actually used.

---

## Developer Impact

**Confusion:**
Listing a category without naming a service suggests:
- Policy was copied from a template
- Not customized for Ultrahope
- May contain other inaccurate sections

**Trust Issue:**
If "Communication & Collaboration Tools" doesn't exist, what else in the policy is wrong?

---

## Recommended Fix

### Option 1: Remove (Recommended)

**Delete line 215:**
```diff
  - Data Storage Service Providers (Turso — https://turso.tech/privacy)

  - Payment Processors (Polar — https://polar.sh/legal/privacy). ...

- - Communication & Collaboration Tools

  - Social Networks
```

**Rationale:**
If no such tools exist, don't list them.

---

### Option 2: Specify (If Applicable)

**If you use a communication tool we missed:**

```markdown
- Communication & Collaboration Tools
  (Resend — https://resend.com/legal/privacy) — for password reset emails
```

But this is redundant with "Email Service Providers" (which should already include Resend).

---

### Option 3: Move to Email Service Providers

**If this was meant to cover Resend:**

```diff
- - Communication & Collaboration Tools

- Email Service Providers
+ - Email Service Providers
+   (Resend — https://resend.com/legal/privacy) — for password reset and account emails
```

---

## Verification Checklist

Before removing:

- [ ] Search codebase for: `slack`, `discord`, `intercom`, `crisp`, `zendesk`
- [ ] Check `package.json` for communication tool dependencies
- [ ] Verify no webhooks to collaboration platforms
- [ ] Confirm Resend is only email service
- [ ] Check if this was meant to refer to something else

After removing:

- [ ] Update Section 4 third-party list
- [ ] Verify no broken references to this category
- [ ] Test that policy still covers all actual third parties

---

## Related Issues

- **Issue #2:** Better-Auth not listed (missing service)
- **Issue #9:** "Social Networks" unclear (similarly vague category)
- **Suggested improvement:** Use table format for third-party services (clearer than category lists)

---

## Competitive Comparison

### Linear (Good Example)
```markdown
Third parties:
- AWS (hosting)
- Stripe (payments)
- Postmark (emails)
- Segment (analytics)
```
✅ Specific services named

### Vercel (Good Example)
```markdown
- Google Cloud Platform (infrastructure)
- Stripe (billing)
- SendGrid (transactional emails)
```
✅ Service name + purpose

### Ultrahope (Current)
```markdown
- Communication & Collaboration Tools
```
❌ No service name, unclear purpose

---

## References

- Privacy policy Section 4: `packages/web/app/privacy/privacy.md:215`
- Email service: `packages/web/lib/auth.ts:49-61` (Resend only)
- No other communication tools found in codebase

---

**Priority rationale:** MEDIUM because:
- Likely just template boilerplate
- Easy to remove
- Doesn't affect legal compliance
- But undermines document credibility

## Resolution

**Completed:** 2026-02-12
**Approach taken:** Remove unused category

Findings:
- No concrete communication/collaboration service was identified as a third-party recipient in the current implementation.
- The category was template-like and ambiguous without a named provider.

Policy update:
- Removed `Communication & Collaboration Tools` from Section 4 third-party categories.
- Kept concrete categories/providers only.

**Files changed:**
- `packages/web/app/privacy/privacy.md`
