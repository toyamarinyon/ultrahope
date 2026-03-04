# Issue #16: GitHub OAuth authentication not mentioned

**Priority:** LOW
**Status:** ✅ DONE

## Problem

**Terms state (Section 1, "Accounts and access"):**
> "Certain features require an account. You agree to provide accurate account information and to keep it up to date."
> "You are responsible for maintaining the confidentiality of your account credentials and access tokens..."

**Reality:** The service supports:
- Email/password authentication
- **GitHub OAuth** (social login)
- Device flow for CLI

**Issue:** When users authenticate via GitHub OAuth:
1. They authorize Ultrahope to access certain GitHub data
2. Account deletion may require revoking GitHub OAuth grants (already implemented in code)
3. Users should understand that using GitHub OAuth means GitHub's terms also apply

**Relevant code:**
- `packages/web/lib/auth.ts:44-48` — Better-Auth with GitHub provider
- `packages/web/app/login/page.tsx:26-31` — GitHub sign-in button in UI
- `packages/web/lib/account-deletion.ts:76-90` — GitHub OAuth grant revocation

## Recommended Action

Add a brief mention of third-party authentication in Section 1:

> "If you use third-party authentication (such as GitHub), you also agree to comply with that provider's terms of service, and we may access limited information from your third-party account as permitted by your authorization."

This sets expectations and clarifies the relationship.

## Resolution

**Completed:** 2026-02-11

Added third-party authentication language to the account section to disclose provider-linked sign-in behavior and applicability of provider terms.

**Summary of changes:**
- Added explicit mention of third-party auth providers (including GitHub as an example).
- Clarified that Ultrahope may receive account information as permitted by user authorization.
- Clarified that provider terms and policies also apply.

**Files changed:**
- `packages/web/app/terms/terms.md:81`
