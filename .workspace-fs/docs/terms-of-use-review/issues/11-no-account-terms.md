# Issue #11: No account-related terms despite full auth system

**Priority:** LOW
**Status:** ⬜ TODO

## Problem

**Terms state:** No section about account creation, account security, or account termination by user.

**Reality:** The service has a full authentication system:
- Email/password registration
- GitHub OAuth
- Device flow for CLI
- Account deletion (self-service from Settings page)
- Session management

**Relevant code:**
- `packages/web/lib/auth.ts` — Better-Auth configuration
- `packages/web/app/settings/page.tsx` — Account settings and deletion
- `packages/web/lib/account-deletion.ts` — Account deletion logic

## Recommended Action

Add a section covering:
- Account registration requirements
- User responsibility for account security (passwords, tokens)
- Account deletion process and consequences
- Our right to suspend/terminate accounts (partially covered in Section 8)

## Resolution

<!-- When resolved, update status above and fill in details here -->
