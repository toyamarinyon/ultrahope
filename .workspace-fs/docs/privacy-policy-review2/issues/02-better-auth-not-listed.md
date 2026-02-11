# Issue #2: Better-Auth Not Listed as Third-Party Service

**Priority:** 🟠 HIGH
**Category:** Third-Party Sharing
**Impact:** Missing major third-party service
**Effort:** 2 minutes
**Status:** ⬜ TODO

---

## Problem

**Policy (Section 4, lines 211-227):**
Lists third-party service categories but does **not** include Better-Auth.

**Reality:**
Better-Auth is the **core authentication framework** that handles:
- Session management (creates/validates session tokens)
- Email/password authentication
- GitHub OAuth proxy
- Device authorization (CLI authentication)
- Password reset email triggers
- All user account operations

**Code evidence:**
```typescript
// packages/web/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";

cachedAuth = betterAuth({
  database: drizzleAdapter(db, {...}),
  basePath: "/api/auth",
  socialProviders: { github: {...} },
  emailAndPassword: {...},
  plugins: [
    bearer(),
    deviceAuthorization({...}),
    polar({...}),
  ],
});
```

Better-Auth processes **extensive personal information**:
- Email addresses
- Session tokens
- IP addresses (potentially — see Issue #5)
- User-Agent strings (potentially — see Issue #5)
- OAuth credentials
- Password hashes

---

## Developer Impact

**Credibility Issue:**
Developers who audit the codebase will immediately notice that Better-Auth is:
- Imported in the main auth file
- The database adapter for all authentication
- The source of all session cookies

Not listing it as a third-party service provider is a **major oversight** that undermines the policy's credibility.

**Developer Reaction:**
> "They list Resend (just for password reset emails) but not Better-Auth (which handles ALL authentication)? Did anyone actually review this?"

---

## Current Third-Party List (Section 4)

**Categories listed:**
- AI Platforms (Vercel AI Gateway)
- Communication & Collaboration Tools *(vague — see Issue #8)*
- Data Storage Service Providers (Turso)
- Payment Processors (Polar)
- Social Networks *(vague — see Issue #9)*
- User Account Registration & Authentication Services *(MISSING BETTER-AUTH)*
- Email Service Providers (Resend implied but not explicit — see previous review)
- Website Hosting Service Providers (Vercel)

Better-Auth should be under **"User Account Registration & Authentication Services"** but is completely absent.

---

## Recommended Fix

### Add to Section 4 (after line 223)

**Insert:**
```markdown
- User Account Registration & Authentication Services
  (Better-Auth — https://www.better-auth.com/docs/concepts/privacy)
```

**Context (lines 221-227):**
```markdown
- Social Networks

- User Account Registration & Authentication Services
  (Better-Auth — https://www.better-auth.com/docs/concepts/privacy)  ← ADD THIS

- Email Service Providers

- Website Hosting Service Providers (Vercel — https://vercel.com/legal/privacy-policy)
```

---

## Better Alternative: Table Format

For **maximum clarity**, replace the entire category list with a table:

```markdown
## Third parties we share data with

| Service | Purpose | Data shared | Privacy Policy |
|---------|---------|-------------|----------------|
| **Vercel AI Gateway** | AI request routing | Code diffs, user ID | [Policy](https://vercel.com/legal/privacy-policy) |
| **Turso** | Database hosting | All account & usage data | [Policy](https://turso.tech/privacy) |
| **Polar** | Metered billing | User ID, usage cost, model, generation ID | [Policy](https://polar.sh/legal/privacy) |
| **Resend** | Password reset emails | Email address | [Policy](https://resend.com/legal/privacy) |
| **Better-Auth** | Authentication & sessions | Email, session tokens, OAuth data | [Docs](https://www.better-auth.com/docs/concepts/privacy) |
| **GitHub** | OAuth login | Profile (name, email, avatar) | [Policy](https://docs.github.com/privacy) |
| **Vercel** | Website hosting | HTTP logs, IP addresses | [Policy](https://vercel.com/legal/privacy-policy) |

We do NOT share data with:
- ❌ Advertising networks
- ❌ Analytics services (no Google Analytics, Mixpanel, Amplitude, etc.)
- ❌ Social media platforms (except GitHub for OAuth login)
```

This table format is **much more developer-friendly** and ensures no services are missed.

---

## Testing Checklist

After adding Better-Auth:

- [ ] Verify Better-Auth privacy policy link works
- [ ] Check if Better-Auth documentation has a dedicated privacy/data handling page
- [ ] Review Better-Auth version (1.4.18) to confirm data handling behavior
- [ ] Cross-reference with IP/User-Agent recording (Issue #5)

---

## Related Issues

- **Issue #5:** IP/User-Agent recording unclear (Better-Auth may auto-populate)
- **Issue #8:** "Communication & Collaboration Tools" unclear (should be removed or specified)
- **Issue #9:** "Social Networks" unclear (should specify GitHub)

---

## Why This Matters

**Legal compliance:**
Privacy policies must disclose **all** third parties who process personal information. Better-Auth processes:
- Authentication credentials
- Session data
- OAuth tokens
- Email addresses

**Developer trust:**
Developers expect technical accuracy. Missing the core authentication provider is a glaring omission.

---

## References

- Privacy policy: `packages/web/app/privacy/privacy.md:211-227`
- Better-Auth usage: `packages/web/lib/auth.ts` (entire file)
- Better-Auth docs: https://www.better-auth.com/docs/concepts/privacy
- Database adapter: `drizzleAdapter` connects Better-Auth to user/session tables

---

**Priority rationale:** HIGH because it's a major omission that affects legal compliance and developer trust. However, not CRITICAL because the privacy policy correctly describes data collection (even if it doesn't attribute it to Better-Auth).
