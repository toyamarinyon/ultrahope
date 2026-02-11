# Issue #3: Data Export Not Implemented

**Priority:** 🟠 HIGH
**Category:** User Rights / GDPR Compliance
**Impact:** GDPR/CCPA requirement gap
**Effort:** Days (if implementing) OR Minutes (if documenting status)
**Status:** ⬜ TODO

---

## Problem

**Policy promises (Section 12, line 312):**
```markdown
These may include the right (i) to request access and obtain a copy of your personal information...
```

**Reality:**
- ❌ No self-service data export feature
- ❌ No API endpoint for data download
- ❌ No "Export JSON" button in Settings
- ⚠️ Users must email support@ultrahope.dev (manual process)

**GDPR Article 15** and **CCPA Section 1798.110** require:
> Right to access: Users can request a copy of their personal data in a portable format.

While you can fulfill this manually via email, a **self-service export** is best practice for developer tools.

---

## Developer Impact

**Expectation:**
Modern developer tools (especially privacy-focused ones) provide self-service data export:
- **Linear:** "Export data" button → JSON download
- **GitHub:** Settings → Export account data → ZIP file
- **Vercel:** Dashboard → Export data → JSON

**Current state:**
Ultrahope has **deletion** (self-service) but **not export** (manual request).

**Developer Reaction:**
> "They implemented self-service deletion but not export? That's backwards. Deleting is more sensitive than exporting."

---

## What Data Should Be Exportable?

Based on the privacy policy (Section 1), users should be able to export:

### 1. Account Information
- Name
- Email address
- Username
- Created date
- Account status

### 2. Session Data
- CLI session IDs
- Session timestamps
- IP addresses (if collected — see Issue #5)
- User-Agent strings (if collected — see Issue #5)

### 3. Command Executions
- Command type (`commit`, `pr-title-body`, etc.)
- Request payload (code diffs)
- Timestamp
- Arguments

### 4. AI Generations
- Generated output (commit messages, PR descriptions)
- Model used
- Provider used
- Cost in microdollars
- Latency
- Vercel AI Gateway metadata
- Timestamp

### 5. User Feedback
- Generation scores (1-5 ratings)
- Timestamp

### 6. Billing Information
- Plan (Free/Pro)
- Usage history
- Polar customer ID

**Total estimated size:** A few KB to a few MB per user (depending on usage)

---

## Solution Options

### Option 1: Implement Self-Service Export (Recommended)

**Add API endpoint:**
```typescript
// packages/web/app/api/account/export/route.ts
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userData = {
    account: await db.select().from(user).where(eq(user.id, session.user.id)),
    sessions: await db.select().from(sessionTable).where(eq(sessionTable.userId, session.user.id)),
    commandExecutions: await db.select().from(commandExecution).where(eq(commandExecution.userId, session.user.id)),
    generations: /* ... join query ... */,
    scores: /* ... join query ... */,
  };

  return Response.json(userData, {
    headers: {
      'Content-Disposition': `attachment; filename="ultrahope-data-${session.user.id}-${Date.now()}.json"`,
    },
  });
}
```

**Add UI in Settings:**
```tsx
// packages/web/app/settings/page.tsx
<button onClick={handleExport}>
  Export My Data (JSON)
</button>
```

**Estimated effort:** 4-6 hours

---

### Option 2: Document Manual Process (Quick Fix)

If you can't implement export immediately, **be honest** about it:

**Update Section 18:**
```markdown
### Export Your Data

⚠️ **Self-service export is not yet available.**

To request a copy of your data, email [support@ultrahope.dev](mailto:support@ultrahope.dev) with:
- Subject: "Data Export Request"
- Your account email address

We will send a JSON file containing:
- Account information
- Command execution history
- AI-generated outputs
- Usage metadata
- Billing records

**Response time:** Within 7 business days

**Roadmap:** Self-service JSON export planned for Q2 2026.
```

**Estimated effort:** 5 minutes

---

## Competitive Comparison

### Linear (Export Implementation)
```
Settings → Security → Export data
→ Generates JSON file with all issues, comments, projects
→ Download link sent via email
```

### GitHub (Export Implementation)
```
Settings → Data → Export account data
→ Includes repos, issues, PRs, comments
→ ZIP file available for 7 days
```

### Ultrahope (Current)
```
Email support@ultrahope.dev → Manual request → ?
```

---

## Recommended Approach

**Short-term (1 week):**
1. ✅ Update Section 18 to document manual export process (Option 2)
2. ✅ Set up support@ultrahope.dev monitoring
3. ✅ Create internal script to generate user data JSON for manual requests

**Long-term (Q2 2026):**
4. ✅ Implement self-service export API endpoint
5. ✅ Add "Export Data" button to Settings page
6. ✅ Update Section 18 to reflect self-service export

---

## Testing Checklist

After implementing export (Option 1):

- [ ] Test export API returns all expected data
- [ ] Verify JSON structure is valid and readable
- [ ] Check that sensitive data (session tokens, passwords) is excluded
- [ ] Confirm export includes all command executions and generations
- [ ] Test export for users with zero usage (empty account)
- [ ] Verify download works in Chrome, Firefox, Safari

After documenting manual process (Option 2):

- [ ] Confirm support@ultrahope.dev is monitored
- [ ] Create internal script to generate export JSON
- [ ] Test script with real user data (anonymized)
- [ ] Document internal export procedure for support team

---

## Data Privacy Considerations

When implementing export:

**Include:**
- ✅ Account info (name, email, created date)
- ✅ Command execution history
- ✅ AI-generated outputs
- ✅ Usage metadata (model, cost, timestamps)
- ✅ User feedback scores
- ✅ Billing history

**Exclude:**
- ❌ Session tokens (security risk)
- ❌ Password hashes (unnecessary, security risk)
- ❌ Internal database IDs (not useful to user)
- ❌ Other users' data (privacy violation)
- ❌ Polar API keys (security risk)

**Format:**
- Use JSON (developer-friendly, machine-readable)
- Pretty-print for human readability
- Include metadata (export date, version, user ID)

---

## Related Issues

- **Issue #1:** Section 18 misleading (needs rewrite to document export status)
- **Issue #6:** User rights section should be developer-friendly

---

## Legal Requirements

### GDPR (Article 15)
> The data subject shall have the right to obtain from the controller... a copy of the personal data undergoing processing.

### CCPA (Section 1798.110)
> A consumer shall have the right to request that a business that collects personal information about the consumer disclose to the consumer... the specific pieces of personal information the business has collected about the consumer.

**Compliance status:**
- ✅ Right exists (policy promises it)
- ⚠️ Implementation is manual (not ideal)
- ✅ No legal violation (manual fulfillment is acceptable)
- 🎯 Best practice: Self-service export

---

## References

- Privacy policy: `packages/web/app/privacy/privacy.md:312`
- Account deletion (for reference): `packages/web/lib/account-deletion.ts`
- User data schema: `packages/web/db/schemas/auth-schema.ts`, `packages/web/db/schemas/app-schema.ts`

---

**Priority rationale:** HIGH because it's a GDPR/CCPA requirement and a user expectation for developer tools. However, not CRITICAL because manual fulfillment via email is legally compliant.
