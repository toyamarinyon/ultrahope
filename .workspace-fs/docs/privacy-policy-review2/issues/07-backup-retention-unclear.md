# Issue #7: Backup Retention Period Unclear

**Priority:** 🟡 MEDIUM
**Category:** Data Retention & Security
**Impact:** Unclear expectations for deleted data
**Effort:** 5 minutes (if known) OR 1 hour (if needs research)
**Status:** ⬜ TODO

---

## Problem

**Policy states (Section 9, line 294):**
```markdown
However, some information may be retained in backup archives for a limited period to comply with legal obligations, resolve disputes, and enforce our agreements.
```

**Issue:**
"Limited period" is **vague and unhelpful**.

**Developer Questions:**
- 30 days?
- 90 days?
- 1 year?
- Forever?

Users deserve to know how long deleted data remains in backups.

---

## Why This Matters

### GDPR Right to Erasure (Article 17)

**User expectation:**
"When I delete my account, my data should be gone."

**Reality:**
Backups may retain data for technical reasons (point-in-time recovery, disaster recovery).

**Best practice:**
- Specify backup retention period
- Explain why backups exist
- Commit to purging old backups

### Developer Trust

**Specific commitment:**
> "Backups are deleted after 30 days"

**Builds confidence:**
- User knows exactly when data is fully gone
- Shows company has thought about data lifecycle
- Demonstrates operational maturity

**Vague statement:**
> "Retained for a limited period"

**Undermines trust:**
- Sounds like legal boilerplate
- Could mean anything from 1 day to 10 years
- Suggests company hasn't actually decided

---

## Recommended Fix

### Option 1: Specify Exact Period (Preferred)

**If you know the backup retention:**
```markdown
When you request account deletion (as described in Section 18), we will delete your account and associated personal information from our active databases. However, some information may be retained in backup archives for up to **30 days** to enable disaster recovery and comply with legal obligations. After 30 days, backups are permanently purged and your data is completely removed from our systems.

**Exception:** Billing records may be retained for 7 years as required by tax and accounting regulations.
```

**Key elements:**
- ✅ Specific timeframe (30 days)
- ✅ Reason for retention (disaster recovery, legal)
- ✅ Commitment to purge (after 30 days, permanently gone)
- ✅ Exception noted (billing records - legally required)

---

### Option 2: Research & Set Policy

**If backup retention is undefined:**

1. **Check Turso backup settings:**
   - What is the point-in-time recovery window?
   - How long are snapshots kept?
   - When are old backups deleted?

2. **Decide on retention policy:**
   - Common: 30 days (balances recovery needs with privacy)
   - Conservative: 90 days
   - Minimal: 7 days

3. **Configure Turso to match policy:**
   - Set automatic backup expiration
   - Document in internal procedures

4. **Update privacy policy** with specific timeframe

**Recommended: 30 days** (industry standard for non-enterprise tools)

---

### Option 3: Honest Admission (If Truly Unknown)

**If you genuinely don't know:**
```markdown
When you delete your account, we immediately remove your data from active systems. Backup retention is managed by our database provider (Turso). We are currently determining the exact retention period and will update this policy once confirmed.

For the latest information, contact support@ultrahope.dev
```

**But this is not ideal.** Better to research and specify.

---

## Implementation Verification

### Check Turso Backup Configuration

**Questions to answer:**
1. Does Turso automatically back up the database?
2. How often? (Daily? Hourly?)
3. How long are backups retained? (7 days? 30 days? Forever?)
4. Can retention be configured?
5. When are old backups purged?

**How to check:**
- Turso dashboard → Database settings → Backups
- Turso CLI: `turso db show ultrahope-production`
- Turso documentation: https://turso.tech/docs/features/backups

**Expected settings:**
```
Backups: Enabled
Frequency: Daily
Retention: 30 days (configurable)
Point-in-time recovery: Last 30 days
```

---

## Competitive Comparison

### Linear
```markdown
We retain backups for 30 days. After 30 days, deleted data is permanently removed.
```
✅ Specific

### GitHub
```markdown
We may retain certain information in backup systems for up to 90 days.
```
✅ Specific

### Vercel
```markdown
Deleted projects are retained in backups for 30 days, then permanently deleted.
```
✅ Specific

### Ultrahope (Current)
```markdown
Retained for a limited period...
```
❌ Vague

---

## Legal Considerations

### GDPR Compliance

**Acceptable:**
- Retaining deleted data in backups for technical reasons
- As long as:
  - Retention period is reasonable (30-90 days)
  - Backups are eventually purged
  - User is informed of retention period

**Not acceptable:**
- Indefinite backup retention
- No commitment to eventual deletion
- Vague "limited period" without specifics

### Tax/Accounting Records Exception

**Important:**
Billing and payment records may need to be retained for **7 years** in many jurisdictions (tax audit requirements).

**How to handle:**
```markdown
**Exception:** Billing records (invoices, payment history) may be retained for 7 years as required by tax and accounting regulations, even after account deletion.
```

This is **legally required** and should be explicitly stated.

---

## Recommended Policy Text

**Replace Section 9, lines 284-295:**

```markdown
## 9. HOW LONG DO WE KEEP YOUR INFORMATION?

In Short: We retain your information for as long as you have an account. Deleted data is purged from backups after 30 days.

We retain your personal information for as long as you maintain an account with us. This includes:

- Account information (name, email, authentication data)
- Service usage data (command executions, generated content, usage history)
- Session data (active and expired sessions are retained until account deletion)

We do not currently implement automated data cleanup based on age or inactivity. Your data remains available so you can access your history and reprocess past submissions at any time.

### When You Delete Your Account

When you request account deletion (as described in Section 18), we will:

1. **Immediately delete** your account and associated personal information from our active databases
2. **Revoke** GitHub OAuth access grants
3. **Cancel** Polar billing subscriptions

**Backup retention:** Deleted data may remain in backup archives for up to **30 days** to enable disaster recovery. After 30 days, backups are permanently purged and your data is completely removed from our systems.

**Billing records:** Transaction records (invoices, payment history) may be retained for **7 years** as required by tax and accounting regulations, even after account deletion.
```

---

## Testing Checklist

After updating the policy:

- [ ] Verify Turso backup retention settings (30 days or other?)
- [ ] Confirm old backups are actually purged (not kept indefinitely)
- [ ] Test account deletion → verify data removed from active DB
- [ ] Document internal procedure for handling deletion requests
- [ ] Set calendar reminder to purge old backups manually (if not automatic)

---

## Related Issues

- **Issue #1:** Section 18 misleading (deletion instructions)
- **Issue #3:** Data export not implemented (users should export before deleting)

---

## References

- Privacy policy Section 9: `packages/web/app/privacy/privacy.md:281-295`
- Turso documentation: https://turso.tech/docs/features/backups
- GDPR Article 17 (Right to erasure): https://gdpr-info.eu/art-17-gdpr/

---

**Priority rationale:** MEDIUM because:
- Not legally critical (having backups is acceptable)
- But significantly improves transparency
- Easy to fix once retention period is known
- Common user question ("How long until my data is fully deleted?")
