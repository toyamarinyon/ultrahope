# Issue #17: Magic Link plugin configured but not accessible to users

**Priority:** LOW
**Status:** ⬜ TODO

## Problem

**Code state (auth.ts:118-128):**
```typescript
magicLink({
  sendMagicLink: async ({ email, url }) => {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "noreply@ultrahope.dev",
      to: email,
      subject: "Sign in to Ultrahope",
      html: `<p>Click the link below to sign in:</p><p><a href="${url}">${url}</a></p>`,
    });
  },
}),
```

The `magicLink` plugin from Better-Auth is configured in the backend, and the email-sending infrastructure is set up via Resend.

**UI state (login/page.tsx):**
The login page only implements:
1. Email/Password (sign in + sign up)
2. GitHub OAuth

There is **no Magic Link input field or "Send magic link" button** in the UI, so users cannot actually trigger the magic link flow.

**Reality:** Magic Link is not a user-facing authentication method — it's only configured in code but not exposed through the UI.

## Recommended Action

**Option 1 (Remove from backend):** Remove the `magicLink` plugin from `auth.ts` to keep the codebase minimal and avoid confusion.

**Option 2 (Implement UI):** Add a Magic Link sign-in option to the login page:
- Add an email-only input field
- Add a "Send magic link" button
- Display confirmation message after sending
- Implement the callback page to handle the magic link token

**Option 3 (Document as future feature):** Keep the backend configuration but document it as a prepared-but-not-enabled feature for future use.

**Recommendation:** Option 1 (remove) is cleanest unless there's a near-term plan to implement the UI. The plugin adds minimal overhead, but removing unused code improves clarity.

## Impact on Terms of Use

**Good news:** Issue #16 incorrectly stated that Magic Link is implemented. Since it's NOT actually implemented, the Terms of Use is correct as-is — it doesn't mention Magic Link.

**Action for Terms of Use:** No changes needed. The current Terms accurately reflect available auth methods:
- Email/Password: ✅ Mentioned implicitly via "account credentials"
- GitHub OAuth: ✅ Mentioned explicitly as "third-party authentication provider (such as GitHub)"
- Magic Link: ❌ NOT mentioned (correct, since it's not accessible to users)

## Resolution

<!-- When resolved, update status above and fill in details here -->
