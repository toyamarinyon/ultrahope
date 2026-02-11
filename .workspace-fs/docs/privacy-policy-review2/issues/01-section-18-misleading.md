# Issue #1: Section 18 is Misleading

**Priority:** 🔴 CRITICAL
**Category:** User Rights
**Impact:** Major credibility issue
**Effort:** 5 minutes
**Status:** ⬜ TODO

---

## Problem

**Policy says (line 534):**
```markdown
To request to review, update, or delete your personal information, please visit:
https://github.com/toyamarinyon/ultrahope/issues
```

**Reality:**
The Settings page (`packages/web/app/settings/page.tsx`) has a "Delete Account" button that provides **instant self-service deletion** without requiring GitHub Issues.

**Implementation verification:**
- ✅ Settings page UI: `packages/web/app/settings/page.tsx`
- ✅ Delete form component: `packages/web/components/delete-account-form.tsx`
- ✅ API endpoint: `packages/web/app/api/account/delete/route.ts`
- ✅ Deletion logic: `packages/web/lib/account-deletion.ts`

The implementation is actually **BETTER** than what the policy claims (self-service vs. manual request), but the mismatch is a **credibility problem**.

---

## Developer Impact

**Trust Issue:**
Developers who read the policy and then use the Settings page will notice the discrepancy immediately. This suggests:
- Policy wasn't updated after implementing self-service deletion
- Nobody is maintaining the privacy policy
- Other parts might be outdated too

**Developer Reaction:**
> "They implemented self-service deletion (great!) but forgot to update the privacy policy. What else is wrong?"

---

## Implementation Details

### Account Deletion Flow (Actual)

1. User goes to **Settings → Danger Zone → Delete Account**
2. User confirms by typing email address
3. API endpoint `/api/account/delete` executes deletion logic
4. `deleteUserByEmail()` function performs:
   - ✅ Deletes user account
   - ✅ CASCADE deletes sessions, command executions, generations, scores
   - ✅ Revokes GitHub OAuth grants
   - ✅ Deletes Polar customer records
   - ✅ Handles verification tokens

**Code reference:**
```typescript
// packages/web/lib/account-deletion.ts:118-321
export async function deleteUserByEmail({ email, mode }: {
  email: string;
  mode: Mode;
}): Promise<DeleteUserReport> {
  // ... comprehensive deletion logic
  const deleted = await db.delete(user)
    .where(and(eq(user.id, targetUser.id), eq(user.email, email)))
    .returning({ id: user.id });
}
```

This is **production-ready self-service deletion**, not a manual GitHub Issues process.

---

## Recommended Fix

### Replace Section 18 (line 532-535)

**Remove:**
```markdown
Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please visit: https://github.com/toyamarinyon/ultrahope/issues.
```

**Replace with:**
```markdown
## 18. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?

Based on the applicable laws of your country or state of residence in the US, you may have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law.

### Delete Your Account

Go to **Settings → Danger Zone → Delete Account** for instant self-service deletion.

This will immediately:
- ✅ Delete all your data (code diffs, AI generations, sessions, feedback)
- ✅ Revoke GitHub OAuth access grants
- ✅ Cancel your Polar billing subscription
- ⚠️ **Cannot be undone** — please export your data first if needed

### Export Your Data

⚠️ **Self-service export is not yet available.**

To request a copy of your data, email [support@ultrahope.dev](mailto:support@ultrahope.dev) with:
- Subject: "Data Export Request"
- Your account email address

We will send a JSON file of your data within 7 business days.

**Roadmap:** Self-service JSON export planned for Q2 2026.

### Update Your Profile

Go to **Settings → Profile** to update your name, email, or other account information.

### Other Requests

For questions about your privacy rights, email [support@ultrahope.dev](mailto:support@ultrahope.dev).
```

---

## Alternative: Minimal Fix

If you want to make a **minimal change** (just fix the inaccuracy):

```markdown
To delete your account, go to **Settings → Danger Zone → Delete Account**.

For data export or other privacy requests, please visit: https://github.com/toyamarinyon/ultrahope/issues or email support@ultrahope.dev.
```

---

## Testing Checklist

After fixing Section 18:

- [ ] Verify Settings page still has "Delete Account" button
- [ ] Test account deletion flow end-to-end
- [ ] Confirm email sent to support@ultrahope.dev is monitored
- [ ] Update FAQ/documentation if it references GitHub Issues for deletion
- [ ] Consider implementing data export feature (see Issue #3)

---

## Related Issues

- **Issue #3:** Data export not implemented (GDPR requirement)
- **Issue #6:** User rights section could be more developer-friendly

---

## References

- Privacy policy: `packages/web/app/privacy/privacy.md:532-535`
- Settings page: `packages/web/app/settings/page.tsx`
- Delete form: `packages/web/components/delete-account-form.tsx`
- API endpoint: `packages/web/app/api/account/delete/route.ts`
- Deletion logic: `packages/web/lib/account-deletion.ts`

---

**Status:** This is the **highest priority** issue. Fix before any other privacy policy improvements.
