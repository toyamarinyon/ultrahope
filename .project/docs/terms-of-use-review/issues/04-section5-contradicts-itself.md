# Issue #4: Section 5 contradicts itself about user content

**Priority:** HIGH
**Status:** ✅ DONE

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

**Completed:** 2026-02-11

Rewrote the opening paragraph of Section 5 to remove the direct contradiction and align with actual product behavior.

**Summary of changes:**
- Removed the false statement that users cannot submit content.
- Clarified that users do submit Contributions (including repository metadata, code diffs, prompts, commands, and feedback) in order to use product features.
- Clarified that Ultrahope is not a public publishing platform and that Contributions are primarily submitted for processing/service operation.

**Files changed:**
- `packages/web/app/terms/terms.md:169`
