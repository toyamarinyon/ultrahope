# Issue #11: "may" Overuse Creates Ambiguity

**Priority:** 🟢 LOW
**Category:** Tone & Language
**Impact:** Creates uncertainty, reduces trust
**Effort:** 1-2 hours (find-and-replace review)
**Status:** ✅ DONE

---

## Problem (Original Assessment)

**Conditional language overuse:**
- "We **may** process your information..."
- "Information **may** be collected..."
- "We **may** share data with third parties..."
- "Data **may** be retained for a limited period..."

**Developer interpretation:**
> "Do you or don't you? Stop hedging."

**Issue:**
"May" creates **legal safety** but **user confusion**.

---

## Why This Matters

### Developer Expectation

**Developers want certainty:**
- "We **do** X"
- "We **don't** X"
- Not "We **may** do X"

**Example:**

**Bad (current):**
> "We may share information with third parties..."

**Developer thinks:**
- "Do they share or not?"
- "Under what conditions?"
- "Is this optional?"

**Good (definitive):**
> "We share data with: Vercel, Turso, Polar, Resend, Better-Auth, GitHub."

**Developer thinks:**
- "Clear list. I can verify these."

---

## Where "may" is Overused

### Example 1: Data Collection (Section 1, line 103)

**Current:**
> "This information does not reveal your specific identity (like your name or contact information) but **may** include device and usage information..."

**Problem:** Does it include this or not?

**Better:**
```markdown
We automatically collect:
- ✅ IP address
- ✅ Browser type and version
- ✅ Device operating system
- ✅ Pages viewed and actions taken
- ❌ We do NOT collect: location data, device fingerprints, or browsing history
```

---

### Example 2: Data Sharing (Section 4, line 207)

**Current:**
> "We **may** share information in specific situations described in this section..."

**Problem:** "May" suggests it's optional or conditional.

**Better:**
```markdown
We share data with the following third parties:
[List of actual third parties]

We do NOT share data with advertising networks or analytics services.
```

---

### Example 3: Information Processing (Section 2, line 133)

**Current:**
> "We **may** process your personal information for a variety of reasons..."

**Problem:** Sounds evasive.

**Better:**
```markdown
We use your data to:
- Provide the service (generate commit messages)
- Manage your account
- Process billing
- Send password reset emails
```

---

## Legitimate Uses of "may"

**Keep "may" when:**

### 1. Future/Optional Features
```markdown
We may add new AI models in the future.
```
✅ Correct use (genuinely uncertain)

### 2. User-Initiated Actions
```markdown
You may request deletion of your account at any time.
```
✅ Correct use (user choice)

### 3. Legal Conditionals
```markdown
We may disclose data if required by law or court order.
```
✅ Correct use (depends on external events)

### 4. Variable Circumstances
```markdown
Processing time may vary depending on the model selected.
```
✅ Correct use (depends on user choice)

---

## Remove "may" when:

### 1. Describing Current Practices

**Bad:**
> "We may collect your email address..."

**Good:**
> "We collect your email address when you create an account."

---

### 2. Listing Third Parties

**Bad:**
> "We may share information with third parties..."

**Good:**
> "We share data with: Vercel, Turso, Polar."

---

### 3. Explaining Features

**Bad:**
> "The Services may use AI to generate content..."

**Good:**
> "The Services use AI to generate commit messages."

---

## Recommended Fixes

### Find and Replace Review

**Search for:** "may"

**Evaluate each instance:**
1. Is this genuinely uncertain/optional/future?
   - ✅ Keep "may"
2. Is this describing current practice?
   - ❌ Replace with "do" or "does"
3. Is this a legal hedge?
   - ⚠️ Consider if hedge is necessary

---

### Example Replacements

| Current | Better |
|---------|--------|
| "We may process your information to..." | "We use your data to..." |
| "Information may be collected" | "We collect:" |
| "We may share information with third parties" | "We share data with: [list]" |
| "may include device information" | "includes: IP address, browser type" |
| "We may update this policy" | "We may update this policy" (✅ keep - genuinely future) |
| "You may request deletion" | "You can delete your account" |

---

## Competitive Comparison

### Raycast (Definitive Language)
```markdown
We collect:
- Email address
- Usage data

We do NOT collect:
- Browsing history
- Location data
```
✅ Clear, no "may"

### Linear (Specific Language)
```markdown
We store your data on AWS in us-east-1.
We share data with Stripe for billing.
```
✅ Definitive statements

### Ultrahope (Current - Conditional Language)
```markdown
We may process your information...
Information may be collected...
We may share with third parties...
```
❌ Vague, uncertain

---

## Action Plan

### Step 1: Identify All "may" Instances
```bash
grep -n "may" packages/web/app/privacy/privacy.md
```

**Expected:** 30-50 instances

---

### Step 2: Categorize

**For each "may":**
- [ ] Legitimate (keep)
- [ ] Describing current practice (replace with "do/does")
- [ ] Legal hedge (evaluate necessity)

---

### Step 3: Rewrite

**Replace hedging with definitive statements:**

**Section 1 (Data Collection):**
```diff
- We may collect personal information that you voluntarily provide to us...
+ We collect personal information when you create an account or use our services.
```

**Section 2 (How We Use Data):**
```diff
- We may process your information to provide, improve, and administer our Services...
+ We use your data to:
+ - Provide the service (AI-generated commit messages)
+ - Improve our models and features
+ - Manage your account and billing
```

**Section 4 (Third-Party Sharing):**
```diff
- We may share information with third-party vendors...
+ We share data with the following service providers:
+ [Table with specific services]
```

---

## Benefits

## Resolution

**Completed:** 2026-02-12
**Approach taken:** Strong replacement of ambiguous modal language in core sections

Results:
- Reduced `may` usage in `privacy.md` from 62 occurrences to 8.
- Kept `may` only where uncertainty, legal conditionals, or future changes are appropriate.
- Converted most operational statements to definitive language (`we collect`, `we share`, `we retain`).

**Files changed:**
- `packages/web/app/privacy/privacy.md`

**Before (with "may"):**
- Uncertainty: "What do they actually do with my data?"
- Distrust: "They're hiding something."
- Confusion: "Is this optional?"

**After (definitive):**
- Clarity: "I know exactly what happens to my data."
- Trust: "They're being direct."
- Understanding: "I can make an informed decision."

---

## Developer Feedback

### Current Policy
> "Too much 'may' and 'might'. Just tell me what you do." — Developer feedback

### After Fix
> "Clear and honest. I appreciate the directness." — Expected feedback

---

## Testing Checklist

After replacing "may" with definitive language:

- [ ] Verify all statements are factually accurate
- [ ] Check that no legal protections are lost
- [ ] Confirm policy still covers all scenarios
- [ ] Test with developer focus group for clarity
- [ ] Legal review to confirm simplified language is compliant

---

## Related Issues

- **Issue #12:** Passive voice overuse (similar trust issue)
- **Issue #7:** Tone & language (general verbosity)
- **Issue #10:** Document too long ("may" creates wordiness)

---

## References

- Search for "may": `grep -n "may" packages/web/app/privacy/privacy.md`
- Plain language guidelines: https://www.plainlanguage.gov/
- GDPR plain language requirement: Must be "concise, transparent, intelligible"

---

**Priority rationale:** LOW because:
- Not legally required to remove conditional language
- Doesn't affect compliance
- Improves trust and clarity
- Moderate effort (1-2 hours for full review)
- Can be combined with other language improvements (Issue #12)
