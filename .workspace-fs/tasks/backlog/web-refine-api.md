# [WEB] Add commit-message refine API (generation + stream)

Owner: satoshi

Context:
- Current commit message API accepts only a diff and optional guide, and is optimized for fresh generation.
- Refine needs a dedicated shape (original selected message + refine instruction) so behavior is explicit and not overloaded into guide text.
- The web side already has shared generation and streaming plumbing for commit-message routes.

Acceptance criteria:
- [ ] Add a new web API endpoint for refine (`/v1/commit-message/refine` and streaming equivalent if required by CLI).
- [ ] Define request schema including: selected/original message, refine instruction, and optional model plus normal session fields.
- [ ] Add a refine-specific system prompt path (or equivalent prompt branching) in `packages/web/lib/llm`.
- [ ] Implement route-level validation, usage checks, billing guard, and generation pipeline behavior consistent with existing commit message routes.
- [ ] Ensure response shape matches existing commit-message responses for reuse by CLI clients.
- [ ] Add/update unit/integration tests for route/validator behavior.
- [ ] Update OpenAPI-generated types (and client generation artifacts if required by repo policy).

Related links:
- `./packages/web/lib/api/routes/commit-message.ts`
- `./packages/web/lib/llm/commit-message.ts`
- `./packages/web/lib/llm/commit-message.server.ts`
- `./packages/web/lib/api/shared/validators.ts`

Next action:
- Add schema+route first, then wire prompt/model branch, then generate endpoint parity tests.
