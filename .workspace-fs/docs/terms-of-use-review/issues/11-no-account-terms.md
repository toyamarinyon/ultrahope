# Issue #11: No account-related terms despite full auth system

**Priority:** LOW
**Status:** ✅ DONE

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

**Completed:** 2026-02-11

Added an account section to cover account data accuracy, credential security responsibilities, unauthorized-access notification, and account deletion effects.

**Summary of changes:**
- Added requirement to provide and maintain accurate account information.
- Added user responsibility for account credentials and access tokens.
- Added requirement to promptly notify Ultrahope of suspected unauthorized access.
- Added account deletion statement and consequences (access/data loss subject to legal retention and data policies).

**Files changed:**
- `packages/web/app/terms/terms.md:77`
