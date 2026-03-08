# [CLI] Add typed SSE decoding for streaming API responses

Owner: satoshi

Context:
- The CLI currently consumes streaming endpoints via handwritten `fetch` and SSE parsing rather than `openapi-fetch`.
- `text/event-stream` does not give end-to-end type safety by itself, so event payloads can drift from server output without compile-time protection.
- We should make streaming event contracts explicit and validate them at runtime instead of relying on loosely typed string parsing.
- A practical approach is to define shared discriminated-union event schemas, serialize SSE `data:` payloads as JSON, and decode them with schema validation in the CLI.

Acceptance criteria:
- [ ] Define a shared event contract for CLI streaming responses as a discriminated union with explicit event variants.
- [ ] Ensure server-side streaming emits JSON payloads that match the shared event contract.
- [ ] Decode SSE payloads in the CLI through runtime validation rather than unchecked `JSON.parse` assumptions.
- [ ] Keep the existing streaming UX and incremental output behavior unchanged.
- [ ] Surface malformed or unknown SSE payloads as clear client errors instead of silent parsing failures.
- [ ] Add focused tests for valid event decoding and invalid payload rejection.
- [ ] Document any intentional limits of the typed SSE approach, especially where OpenAPI cannot express the stream contract directly.

Related links:
- `./packages/cli/lib/api-client.ts`
- `./packages/web/lib/api/routes/commit-message.ts`
- `./packages/web/lib/api/routes/pr.ts`
- `./packages/shared`

Next action:
- Audit the current SSE event shapes on both CLI and web, then extract a shared schema and thread it through the streaming encoder/decoder path.
