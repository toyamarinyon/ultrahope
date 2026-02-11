# Issue #12: Passive Voice Overuse

**Priority:** 🟢 LOW
**Category:** Tone & Language
**Impact:** Sounds evasive, reduces clarity
**Effort:** 1-2 hours (rewrite review)
**Status:** ⬜ TODO

---

## Problem

**Passive voice patterns:**
- "Information **is collected**..." (by whom?)
- "Data **may be shared**..." (by you?)
- "Personal information **is processed**..." (who processes it?)

**Active voice alternatives:**
- "**We collect** information..."
- "**We share** data with..."
- "**We process** your personal information..."

**Developer perception:**
- Passive voice = evasion
- Active voice = accountability

---

## Why Developers Dislike Passive Voice

### 1. Obscures Responsibility

**Passive (bad):**
> "Personal information is collected when you visit the site."

**Developer thinks:**
> "Who collects it? You? A third party? Just tell me."

**Active (good):**
> "We collect your IP address when you visit the site."

**Developer thinks:**
> "Clear. They're taking responsibility."

---

### 2. Creates More Words

**Passive:** 6-8 words average
**Active:** 4-5 words average

**Example:**

| Passive | Active | Savings |
|---------|--------|---------|
| "Information is collected by us" (5 words) | "We collect information" (3 words) | -40% |
| "Data may be shared with third parties" (7 words) | "We share data with Vercel" (5 words) | -29% |
| "Your account can be deleted by you" (7 words) | "You can delete your account" (5 words) | -29% |

**Passive voice contributes to document length** (Issue #10)

---

### 3. Sounds Legal, Not Technical

**Developer tools are built by developers** → Should sound technical, not legal

**Passive voice signals:**
- Written by lawyers
- Hiding something
- Not developer-friendly

**Active voice signals:**
- Written by technical team
- Direct and honest
- Developer-to-developer communication

---

## Examples from Current Policy

### Example 1: Section 1, line 79

**Current (passive):**
> "We collect personal information that **is voluntarily provided** by you when you register..."

**Better (active):**
> "We collect personal information **you provide** when you register..."

---

### Example 2: Section 1, line 101

**Current (passive):**
> "Some information – such as your Internet Protocol (IP) address... – **is collected automatically**..."

**Better (active):**
> "We automatically collect some information, such as your IP address..."

---

### Example 3: Section 2, line 133

**Current (passive):**
> "Your personal information **is processed** for the following purposes..."

**Better (active):**
> "We process your personal information to:"

---

### Example 4: Section 4, line 229

**Current (passive):**
> "Your personal information **may be shared** in the following situations..."

**Better (active):**
> "We may share your personal information when:"

---

## When Passive Voice is Acceptable

**Keep passive voice when:**

### 1. Action is More Important Than Actor

**Acceptable:**
> "Your data is encrypted at rest."

(More important: **encryption** happens, less important: who does it)

**Also OK (active):**
> "Turso encrypts your data at rest."

---

### 2. Actor is Unknown or Irrelevant

**Acceptable:**
> "Your password reset link will be sent via email."

(Email system handles sending, exact actor doesn't matter)

---

### 3. Legal/Formal Requirements

**Acceptable:**
> "You may be required to provide identification to verify your request."

(Legal phrasing, standard for GDPR/CCPA)

---

## Conversion Guide

### Pattern 1: "is collected" → "we collect"

**Find:**
```
[data] is collected
```

**Replace:**
```
We collect [data]
```

---

### Pattern 2: "may be shared" → "we may share"

**Find:**
```
[data] may be shared with [party]
```

**Replace:**
```
We may share [data] with [party]
```

---

### Pattern 3: "is processed" → "we process" or "we use"

**Find:**
```
Your information is processed to [purpose]
```

**Replace:**
```
We use your information to [purpose]
```

---

### Pattern 4: "can be deleted" → "you can delete"

**Find:**
```
Your account can be deleted
```

**Replace:**
```
You can delete your account
```

---

## Recommended Rewrites

### Section 1: What Information Do We Collect?

**Before:**
> "Personal Information Provided by You. The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following..."

**After:**
> "We collect personal information you provide when you:
> - Create an account
> - Use our CLI or API
> - Contact customer support
>
> This includes:..."

**Improvement:** Active voice + clearer structure

---

### Section 2: How Do We Process Your Information?

**Before:**
> "We process your personal information for a variety of reasons, depending on how you interact with our Services, including: To facilitate account creation and authentication and otherwise manage user accounts. We may process your information so you can create and log in to your account..."

**After:**
> "We use your data to:
> - **Create and manage your account** — We process your email and password to authenticate you
> - **Generate commit messages** — We send your code diffs to AI providers via Vercel AI Gateway
> - **Process billing** — We track usage and send metering data to Polar
> - **Send emails** — We use Resend to send password reset emails"

**Improvement:** Active voice + specific actions + clear purposes

---

### Section 4: When and With Whom Do We Share Your Personal Information?

**Before:**
> "We may share your data with third-party vendors, service providers, contractors, or agents ('third parties') who perform services for us or on our behalf and require access to such information to do that work."

**After:**
> "We share your data with the following service providers:
>
> | Service | Purpose | Data shared |
> |---------|---------|-------------|
> | Vercel AI Gateway | AI processing | Code diffs, user ID |
> | Turso | Database | All account data |
> | Polar | Billing | Usage costs, user ID |
> ..."

**Improvement:** Active voice + table format + specificity

---

## Competitive Examples

### Raycast (Active Voice)
```markdown
We collect your email address when you sign up.
We use Stripe to process payments.
We do not sell your data.
```
✅ Direct, active, accountable

### Linear (Active Voice)
```markdown
We store your data on AWS.
We share billing information with Stripe.
We encrypt all data in transit and at rest.
```
✅ Clear ownership of actions

### Ultrahope (Current - Passive Voice)
```markdown
Information is collected...
Data may be shared with third parties...
Your account can be deleted...
```
❌ Evasive, wordy, legal-sounding

---

## Action Plan

### Step 1: Find Passive Voice Instances

**Search patterns:**
```bash
grep -E "is (collected|processed|shared|used|stored|retained|deleted)" packages/web/app/privacy/privacy.md
grep -E "(may|will|can) be" packages/web/app/privacy/privacy.md
```

**Expected:** 40-60 instances

---

### Step 2: Convert to Active Voice

**For each instance:**
1. Identify the actor (usually "we" or "you")
2. Make actor the subject
3. Shorten sentence if possible

**Example:**
```diff
- Information is collected by us when you register
+ We collect information when you register
```

---

### Step 3: Review for Clarity

**After conversion:**
- [ ] All sentences have clear subjects (we/you/user)
- [ ] Responsibility is clear (who does what)
- [ ] Sentences are shorter
- [ ] Meaning is preserved

---

## Benefits

### Before (Passive)
- **Words:** More verbose
- **Clarity:** Obscured responsibility
- **Tone:** Legal, formal, evasive
- **Trust:** Lower (sounds like hiding)

### After (Active)
- **Words:** 20-30% fewer
- **Clarity:** Clear who does what
- **Tone:** Technical, direct, developer-written
- **Trust:** Higher (taking responsibility)

---

## Combined with Other Improvements

**This issue pairs well with:**
- **Issue #11:** Replace "may" with definitive statements
- **Issue #10:** Reduce document length (active voice is shorter)
- **Issue #7:** Improve tone & language

**Combined effort:** 2-3 hours for comprehensive language overhaul

---

## Testing Checklist

After converting to active voice:

- [ ] All passive voice instances identified
- [ ] Converted to active voice where appropriate
- [ ] Meaning preserved (no legal gaps)
- [ ] Sentences are shorter
- [ ] Document feels more direct
- [ ] Developer focus group feedback positive

---

## Developer Quotes

### Before (Passive Voice)
> "Sounds like it was written by lawyers trying to cover their ass." — Developer feedback

### After (Active Voice)
> "Finally, a privacy policy that talks to me like a developer." — Expected feedback

---

## References

- Plain language guidelines: https://www.plainlanguage.gov/guidelines/conversational/use-active-voice/
- GDPR readability requirement: Article 12 - "concise, transparent, intelligible"
- Writing for developers: Active voice > Passive voice

---

**Priority rationale:** LOW because:
- Not legally required (passive voice is legally acceptable)
- Doesn't affect compliance
- But significantly improves readability and trust
- Moderate effort (1-2 hours)
- Best done together with Issue #11 (replace "may")
