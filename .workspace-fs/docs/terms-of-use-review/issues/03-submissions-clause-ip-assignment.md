# Issue #3: "Submissions" clause implies IP assignment of user code

**Priority:** HIGH
**Status:** ⬜ TODO

## Problem

**Terms state (Section 2, "Your submissions"):**
> "By directly sending us any question, comment, suggestion, idea, feedback, or other information about the Services ('Submissions'), you agree to assign to us all intellectual property rights in such Submission."

**Reality:** Users submit their git diffs (which contain their proprietary source code) to the service for processing. While the clause says "about the Services" (intended for feedback), the broad language ("or other information") could be interpreted to cover code diffs submitted through the service. This is a significant legal risk — no developer would knowingly assign IP rights to their source code.

**Relevant code:**
- `packages/web/lib/api.ts` — API endpoints receive full git diffs as request payloads
- `packages/web/lib/schema.ts` — Schema defines `diff` field in request bodies
- `commandExecution` and `generation` tables store submitted diffs

## Recommended Action

Clarify that "Submissions" refers only to feedback, suggestions, and communications about the service — not to code, diffs, or other content submitted for processing. Add an explicit clause that users retain full IP rights to their submitted code.

## Resolution

<!-- When resolved, update status above and fill in details here -->
