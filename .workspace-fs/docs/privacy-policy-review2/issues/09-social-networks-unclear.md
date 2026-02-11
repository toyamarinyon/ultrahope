# Issue #9: "Social Networks" Unclear

**Priority:** 🟡 MEDIUM
**Category:** Third-Party Sharing
**Impact:** Unclear what this refers to
**Effort:** 2 minutes
**Status:** ⬜ TODO

---

## Problem

**Policy lists (Section 4, line 221):**
```markdown
- Social Networks
```

**Issue:**
- No specific service named
- Presumably refers to GitHub (OAuth login)
- But could be misinterpreted as data sharing with social media platforms

**Developer Questions:**
- Facebook? Twitter? LinkedIn?
- Or just GitHub OAuth?
- Are we sharing data with social networks?

---

## Why This Matters

**Developer Concern:**
"Social Networks" suggests data might be shared with:
- Facebook for analytics
- Twitter for social features
- LinkedIn for professional networking

But Ultrahope only uses **GitHub for OAuth login** (not social sharing).

**Misleading Category:**
GitHub is a **code hosting platform**, not a traditional "social network" in the Facebook/Twitter sense.

---

## Developer Impact

**Confusion:**
Developers might think:
- "Are they posting my commits to Twitter?"
- "Do they share my data with Facebook?"
- "Why does a CLI tool need social networks?"

**Better category:**
"Authentication Providers" or "OAuth Providers"

---

## Recommended Fix

### Option 1: Specify GitHub (Preferred)

```diff
- - Social Networks
+ - Social Networks
+   (GitHub — https://docs.github.com/privacy) — for OAuth login only
```

Or better:

```diff
- - Social Networks
+ - OAuth Authentication Providers
+   (GitHub — https://docs.github.com/privacy)
```

---

### Option 2: Integrate with Better-Auth

**If adopting table format (recommended):**

```markdown
| Service | Purpose | Data shared | Privacy Policy |
|---------|---------|-------------|----------------|
| **Better-Auth** | Authentication framework | Email, session tokens | [Docs](https://www.better-auth.com/docs/concepts/privacy) |
| **GitHub** | OAuth login | Profile (name, email, avatar) | [Policy](https://docs.github.com/privacy) |
```

This makes it **crystal clear**:
- GitHub is for authentication
- Only profile data is shared
- No social media posting or sharing

---

### Option 3: Add Clarifying Note

```markdown
- Social Networks (GitHub — for OAuth login only)

**Note:** We use GitHub solely for account authentication. We do not post to social media, share your data with social networks, or integrate with platforms like Facebook, Twitter, or LinkedIn.
```

---

## Implementation Verification

**GitHub OAuth usage confirmed:**
```typescript
// packages/web/lib/auth.ts:43-47
socialProviders: {
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? "",
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
  },
},
```

**What data is shared with GitHub:**
- User grants OAuth permission
- GitHub sends profile data (name, email, avatar URL)
- Better-Auth stores this in `account` table
- No data sent *to* GitHub (except OAuth grant)

**Account deletion:**
```typescript
// packages/web/lib/account-deletion.ts:58-96
// Revokes GitHub OAuth grants when user deletes account
await revokeGithubGrant(gh.accessToken);
```

✅ Proper cleanup on deletion

---

## What NOT to Suggest

**Avoid:**
- "We don't share with social networks" (contradicts listing them)
- Removing category entirely (GitHub OAuth is used, should be disclosed)

**Instead:**
- Specify exactly what "Social Networks" means (GitHub OAuth)
- Use clearer category name ("OAuth Providers")

---

## Competitive Comparison

### Linear
```markdown
- GitHub (for OAuth authentication)
```
✅ Specific and clear

### Vercel
```markdown
- GitHub OAuth (optional login method)
```
✅ Purpose stated

### Ultrahope (Current)
```markdown
- Social Networks
```
❌ Vague, potentially misleading

---

## Testing Checklist

After updating:

- [ ] Verify no other social integrations exist (Twitter, Facebook, LinkedIn)
- [ ] Confirm GitHub is only for OAuth (not social sharing)
- [ ] Check if GitHub webhooks are used (for repository integrations)
- [ ] Test OAuth flow (GitHub login works)
- [ ] Verify OAuth grant revocation on account deletion

---

## Related Issues

- **Issue #2:** Better-Auth not listed (GitHub OAuth is proxied through Better-Auth)
- **Issue #8:** "Communication & Collaboration Tools" unclear (similarly vague category)
- **Suggested improvement:** Table format for third-party services

---

## Recommended Final Text

**If using table format:**

```markdown
| Service | Purpose | Data shared | Privacy Policy |
|---------|---------|-------------|----------------|
| **GitHub** | OAuth login (optional) | Profile: name, email, avatar | [Policy](https://docs.github.com/privacy) |
```

**If using category list:**

```markdown
- OAuth Authentication Providers
  (GitHub — https://docs.github.com/privacy) — for optional social login
```

**If keeping "Social Networks":**

```markdown
- Social Networks
  (GitHub — https://docs.github.com/privacy) — used only for OAuth login, not social sharing
```

---

## Developer Benefit

**Before:** "Social Networks? Why does a CLI tool need that?"

**After:** "GitHub OAuth for login. Makes sense, optional, clear."

---

## References

- Privacy policy Section 4: `packages/web/app/privacy/privacy.md:221`
- GitHub OAuth config: `packages/web/lib/auth.ts:43-47`
- OAuth grant revocation: `packages/web/lib/account-deletion.ts:58-96`
- Section 7 (Social logins): `packages/web/app/privacy/privacy.md:261-268`

---

**Priority rationale:** MEDIUM because:
- Technically accurate (GitHub is used)
- But misleading category name
- Easy to clarify with 2-minute edit
- Improves developer understanding
