# Issue #4: Section 5 contradicts itself about user content

**Priority:** HIGH
**Status:** ⬜ TODO

## Problem

**Terms state (Section 5, User Generated Contributions):**
> "The Services does not offer users to submit or post content."

Immediately followed by:
> "We may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or on the Services..."

**Reality:** Users actively submit content (git diffs) and receive generated content (commit messages, PR descriptions). The `generationScore` table also stores user feedback ratings. The first sentence is factually wrong, and the two sentences contradict each other.

**Relevant code:**
- `packages/web/lib/schema.ts` — `commandExecution`, `generation`, `generationScore` tables
- `POST /v1/commit-message`, `POST /v1/pr-title-body` — Accept user-submitted diffs

## Recommended Action

Rewrite Section 5 to accurately describe the content users submit (git diffs, command arguments) and the content the service generates (commit messages, PR titles/bodies). Remove the contradictory opening sentence.

## Resolution

<!-- When resolved, update status above and fill in details here -->
