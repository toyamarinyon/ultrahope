# Issue #5: IP/User-Agent Recording Unclear

**Priority:** 🟡 MEDIUM
**Category:** Information Collection Transparency
**Impact:** Potential accuracy issue (claiming to collect data that may not be collected)
**Effort:** 1 hour (investigation) + 2 minutes (fix)
**Status:** ✅ DONE

---

## Problem (Original Assessment)

**Policy claims (Section 1, line 119):**
```markdown
Session Data. A unique CLI session identifier, IP address, and User-Agent string are recorded for each session.
```

**Reality (verified):**
- ✅ CLI session ID: collected in `command_execution.cliSessionId`
- ✅ IP/User-Agent: collected for authentication sessions in Better-Auth `session` records
- ⚠️ Original policy wording incorrectly implied IP/User-Agent are recorded per CLI session

**Database schema:**
```typescript
// packages/web/db/schemas/auth-schema.ts:33-34
ipAddress: text("ip_address"),
userAgent: text("user_agent"),
```

The schema fields exist and Better-Auth populates them during session creation using request headers.

---

## Investigation Summary

### Question 1: Does Better-Auth Auto-Populate IP/User-Agent?

**Better-Auth version:** 1.4.18 (from `package.json`)

**Hypothesis:**
Better-Auth session creation might automatically extract `IP` and `User-Agent` from request headers and populate these fields.

**Verification performed:**
1. Checked Better-Auth source code in `opensrc/`
2. Confirmed `createSession` sets `ipAddress` and `userAgent` from request headers
3. Confirmed project does not disable IP tracking in Better-Auth advanced options

**Result:**
Auto-population is confirmed by code:
- `ipAddress: headers ? getIp(headers, options) || "" : ""`
- `userAgent: headers?.get("user-agent") || ""`

---

### Question 2: Policy alignment fix

**Two options:**

#### Option A: Collect IP/User-Agent (Keep Policy As-Is)
**Why:**
- Useful for security (detecting suspicious logins from new IPs)
- Helps with abuse detection
- Standard practice for web services

**How:**
Add explicit logging in session creation:
```typescript
// packages/web/lib/auth.ts or wherever sessions are created
const ipAddress = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
const userAgent = req.headers.get("user-agent") || "unknown";

await db.insert(session).values({
  userId,
  token,
  ipAddress,
  userAgent,
  // ...
});
```

**Effort:** 10 minutes

---

#### Option B: Don't Collect IP/User-Agent (Update Policy)
**Why:**
- Minimizes data collection (better for privacy)
- Reduces storage and potential liability
- Aligns with "collect only what's necessary" principle

**How:**
Remove IP/User-Agent from privacy policy:
```diff
- Session Data. A unique CLI session identifier, IP address, and User-Agent string are recorded for each session.
+ Session Data. A unique CLI session identifier is recorded for each session.
```

And optionally remove schema fields:
```diff
// packages/web/db/schemas/auth-schema.ts
- ipAddress: text("ip_address"),
- userAgent: text("user_agent"),
```

**Effort:** 5 minutes (policy) + 15 minutes (schema migration if removed)

---

## Developer Impact

**Trust Issue:**
If the policy claims to collect IP/User-Agent but doesn't actually do it:
- Minor inaccuracy (overclaiming data collection)
- Not a legal issue (claiming more than you collect is safer than the reverse)
- But undermines technical credibility

**Developer Preference:**
Most privacy-focused developers prefer **minimal data collection**. If IP/User-Agent aren't actively used, **don't collect them**.

---

## Recommended Approach

Update policy wording to distinguish:
- CLI/API command execution data (`cliSessionId`)
- Authentication session data (`ipAddress`, `userAgent`)

This avoids claiming per-CLI IP/User-Agent capture while preserving correct disclosure of auth-session logging.

---

## Security Considerations

**Why collect IP/User-Agent:**
- ✅ Detect account takeover (login from new location)
- ✅ Block brute-force attacks (rate-limit by IP)
- ✅ Audit trail for security incidents

**Why NOT collect IP/User-Agent:**
- ✅ Reduces privacy footprint
- ✅ Simpler data retention/deletion
- ✅ Less risk in case of database breach

**Ultrahope context:**
- Small-scale tool (not high-value target)
- GitHub OAuth available (reduces password attack surface)
- CLI-focused (fewer web login attacks)

**Verdict:** IP/User-Agent collection is **nice to have but not essential** for Ultrahope.

---

## Alternative: Clarify Purpose

If you **do** collect IP/User-Agent, explain **why** in the policy:

```markdown
Session Data. A unique CLI session identifier, IP address, and User-Agent string are recorded for each session for security purposes (detecting suspicious logins and preventing unauthorized access).
```

This makes the collection more justifiable to privacy-conscious developers.

---

## Testing Checklist

After fix:

- [x] Verify Better-Auth v1.4.18 auto-populates IP/User-Agent in source
- [x] Confirm project config does not disable IP tracking
- [x] Update privacy policy wording to remove CLI-session ambiguity

---

## Related Issues

- **Issue #2:** Better-Auth not listed (may be source of IP/User-Agent collection)
- **Issue #6:** Security measures vague (IP/User-Agent could be part of security disclosure)

---

## References

- Privacy policy claim: `packages/web/app/privacy/privacy.md:119`
- Database schema: `packages/web/db/schemas/auth-schema.ts:33-34`
- Better-Auth configuration: `packages/web/lib/auth.ts`
- Better-Auth version: `packages/web/package.json` (1.4.18)
- Better-Auth session creation: `opensrc/repos/github.com/better-auth/better-auth/packages/better-auth/src/db/internal-adapter.ts:299-300`
- Better-Auth IP options: `opensrc/repos/github.com/better-auth/better-auth/packages/core/src/types/init-options.ts:142-160`

---

**Priority rationale:** MEDIUM because wording accuracy impacts transparency and trust, but the data handling itself was already implemented.

## Resolution

**Completed:** 2026-02-12

Findings:
- Better-Auth auto-populates and stores `ipAddress`/`userAgent` for authentication sessions.
- `command_execution` stores `cliSessionId` but does not store IP/User-Agent.

Policy update:
- Rewrote Section 1 "Session Data" to clearly separate CLI/API command session identifiers from authentication session IP/User-Agent logging.

**Files changed:**
- `packages/web/app/privacy/privacy.md`
