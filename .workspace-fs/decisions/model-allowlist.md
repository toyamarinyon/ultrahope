# Model Allowlist

## Status

Accepted

## Context

Ultrahope routes generation requests through the Vercel AI Gateway, which supports a wide range of models from multiple providers. Until now, the API accepted any model string and passed it directly to the Gateway — if the Gateway supported it, it worked.

This was fine during early development, but becomes a problem as we build user-facing configuration:

1. **The `/models` page lists specific models.** We show users which models are available on `ultrahope.dev/models`. If the API accepts anything, this page is misleading — it implies a curated set, but there's no enforcement.
2. **CLI config files reference model IDs.** With the config file approach ([cli-config-file.md](cli-config-file.md)), users write model IDs in `.ultrahope.toml`. If they typo a model ID or use one we don't support, the error comes from the AI Gateway — unclear and unhelpful.
3. **Cost and quality control.** Not all Gateway models are suitable for our use cases (commit messages, PR descriptions). Some are too expensive, some produce poor results. We should only offer models we've evaluated.
4. **Billing predictability.** Our pricing model ([billing-model-v2.md](billing-model-v2.md)) uses Vercel AI Gateway's `total_cost`. Allowing arbitrary models means unpredictable costs that could drain a user's credit in a single request.

## Decision

Maintain an **allowlist of supported models** in `packages/web` and validate the `model` parameter on every generation API request. The CLI does not validate locally — it relies on the API's 400 response.

## Where the allowlist lives

**Single source of truth:** A constant in `packages/web` (e.g., `packages/web/lib/llm/models.ts`).

Both the API validation and the `/models` page import from the same constant. This eliminates the risk of the page showing one set of models while the API accepts a different set.

```typescript
export const ALLOWED_MODELS = [
  { id: "mistral/ministral-3b", provider: "Mistral AI", providerUrl: "https://mistral.ai" },
  { id: "xai/grok-code-fast-1", provider: "xAI", providerUrl: "https://x.ai" },
] as const;

export const ALLOWED_MODEL_IDS = ALLOWED_MODELS.map((m) => m.id);
```

### Why not in `packages/core`?

`packages/core` no longer exists; it was merged back into `packages/web` during the monolith migration. Creating a shared package just for a small constant is not justified today. If `packages/core` is reintroduced later, the allowlist can move there.

### Why not in the CLI?

The CLI's job is to read user config and send requests. It should not duplicate the list of valid models — that's the API's responsibility. If the CLI validated locally, it would need to stay in sync with the API, creating a version coupling problem (old CLI rejecting models that the API now supports, or vice versa).

## API Validation

When the API receives a `model` parameter not in the allowlist, it returns **400 Bad Request**:

```json
{
  "error": "invalid_model",
  "message": "Model 'foo/bar' is not supported.",
  "allowedModels": ["mistral/ministral-3b", "xai/grok-code-fast-1"]
}
```

Including `allowedModels` in the response lets the CLI display a helpful error without hardcoding the list:

```
Error: Model 'foo/bar' is not supported.
Available models: mistral/ministral-3b, xai/grok-code-fast-1
```

## CLI Behavior

The CLI does **not** validate model IDs locally. It sends whatever the user configured and handles the API response:

- **200** → proceed normally
- **400 (invalid_model)** → show error with the allowed models from the response body
- No network call just to check models — validation happens as part of the generation request itself

This keeps the CLI thin and always in sync with the API's current allowlist.

## `/models` Page

The existing `packages/web/app/models/page.tsx` currently hardcodes the model list inline. It should import from the same `ALLOWED_MODELS` constant so it stays in sync automatically.

## Adding a New Model

1. Evaluate the model for quality and cost
2. Add an entry to `ALLOWED_MODELS` in `packages/web/lib/llm/models.ts`
3. The `/models` page and API validation update automatically
4. Update `DEFAULT_MODELS` in CLI if it should be a default (separate concern — see [cli-config-file.md](cli-config-file.md))

## References

- [cli-config-file.md](cli-config-file.md) — Config file approach for user model preferences
- [billing-model-v2.md](billing-model-v2.md) — USD-based billing tied to per-request cost
- Multi-model generation design and implementation decisions are now reflected in task and decision notes.
