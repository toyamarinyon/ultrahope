# Core Package Architecture

## Decision: separate LLM logic in packages/core

Extract a pure LLM abstraction layer into **packages/core** and share it from web and cli.

## Structure

```
packages/
  core/                        # Pure LLM logic (no auth/billing)
    src/
      types.ts                 # LLMProvider, LLMResponse, Target
      prompts.ts               # PROMPTS definitions
      providers/
        cerebras.ts            # Cerebras implementation
      index.ts                 # translate() — pure LLM calls only
    package.json               # name: @ultrahope/core (private)
  web/                         # Auth + billing + API
    src/lib/llm/
      index.ts                 # core.translate() + recordTokenConsumption()
  cli/                         # User-facing CLI
    src/
      commands/translate.ts    # via web API or direct core call
```

## Dependencies

```
web → core  (translate + billing wrapper)
cli → core  (for local testing without auth)
cli → web   (via production API requiring auth)
```

## Benefits

1. **Separation of concerns**: core = pure LLM, web = auth + billing + API, cli = user-facing
2. **Easier testing**: core can be tested as standalone functions
3. **Clear dependency direction**: one-way usage where web/cli depend on core

## Implementation

1. Create `packages/core/`
2. Move types, prompts, providers from `packages/web/src/lib/llm/`
3. Make `packages/web/src/lib/llm/index.ts` import core + billing wrapper
4. Move `packages/web/src/lib/llm/cli.ts` into `packages/core/`
