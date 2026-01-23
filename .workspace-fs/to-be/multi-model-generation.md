# Multi-Model Generation

> This document represents to-be, not as-is

## Idea

Instead of using a single model multiple times to generate candidates, use **multiple different LLM providers** to generate results in parallel. Users can then choose the best output from diverse perspectives.

## Why

- Different models have different strengths and biases
- More diverse outputs than `n` candidates from one model
- Users can compare quality across providers
- Some models may be better for specific tasks (commit messages vs PR descriptions)

## API Extension

```
POST /v1/translate
```

Request (extended):
```json
{
  "input": "<stdin content>",
  "target": "vcs-commit-message",
  "models": ["cerebras", "openai", "anthropic"]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `models` | string[] | `["cerebras"]` | List of models to use |

Response:
```json
{
  "results": [
    { "model": "cerebras", "output": "..." },
    { "model": "openai", "output": "..." },
    { "model": "anthropic", "output": "..." }
  ]
}
```

## CLI UX

```bash
git diff | ultrahope translate --target vcs-commit-message --models openai,anthropic,cerebras
```

### Grid-based Interactive Selector

Display candidates in a 2×2 grid layout for easy side-by-side comparison:

```
Select a commit message:

    > [1] feat: add user authentication       [2] fix: resolve memory leak        
                                                                                  
          Implement JWT-based auth flow           Fix unclosed DB connections     
          Add login/logout endpoints              Add proper cleanup handlers     
          Include session management             [Anthropic Claude Sonnet 4.5]                                
          [OpenAI GPT-5.2]

      [3] refactor: simplify API layer        [4] docs: update README             
                                                                                  
          Extract common utilities                Add installation guide          
          Reduce code duplication                 Include API examples            
          Improve error handling                  [Cerebras Llama 3.1 8b]
          [Cerebras GLM 4.7]

[1-4] Select  [e] Edit  [Enter] Confirm  [r] Reroll  [q] Abort
```

### Grid UI Features

- **2×2 card layout** — each card shows title + body preview + model name
- **Number keys (1-4)** — quick select by pressing number
- **Arrow keys** — navigate between cards
- **[e] Edit** — open selected candidate in `$EDITOR`
- **[r] Reroll** — regenerate all candidates
- **[Enter] Confirm** — use selected candidate
- **[q] Abort** — cancel without selection

### Card Content

| Line | Content |
|------|---------|
| 1 | `[n] <commit title>` (first line, highlighted if selected) |
| 2-4 | Body preview (truncated) |
| 5 | `[Provider Model Name]` (dimmed) |

## Candidate Models

| Provider | Model | Notes |
|----------|-------|-------|
| Cerebras | llama-4-scout-17b-16e-instruct | Current default, fast |
| OpenAI | gpt-4o-mini | Good balance |
| Anthropic | claude-3-haiku | Fast, concise |
| Groq | llama-3.3-70b-versatile | Fast inference |
| Google | gemini-2.0-flash | Good for structured output |

## Implementation Considerations

- Run model calls in parallel (Promise.all)
- Handle partial failures (some models may fail)
- Billing: track tokens per provider separately
- Provider abstraction already exists in `packages/core`

## Decisions

### Pricing: Subscription + Included Credit (Zed-style)

**Model:** Subscription fee + included usage credit, then actual cost (no markup).

| Plan | Monthly Fee | Included Credit | Overage |
|------|-------------|-----------------|---------|
| Free | $0 | $0.40 | N/A (hard cap) |
| Pro | $10 | $5 | Actual cost (no markup) |

**Why this model:**
- Avoids "$X in = $X out" problem
- Keeps pricing honest and transparent
- Value proposition is clear: you pay for the **product experience** (UX, orchestration, multi-candidate, fallback, safety, time saved), not marked-up tokens

**Implementation:**
- Vercel AI Gateway provides `total_cost` per generation in USD
- Track usage in USD, deduct directly from user credits
- No need to maintain per-model pricing tables

### Generation mode

Simple rule: **each model generates 1 output**.

- `--models openai,anthropic,cerebras` → 3 candidates (one from each)
- No `n` parameter — model count = candidate count

### Default model set & User Configuration

**API:** `models` param controls which models to use for generation.

**CLI UX:** Users configure their preferred model set via **settings UI** (web). No need to type `--models` on every command.

Flow:
1. User logs in → visits settings UI on ultrahope.dev
2. Selects preferred models (e.g., OpenAI + Anthropic)
3. CLI reads user's saved preferences from API
4. All commands use configured models automatically

**Default:** Single model (Cerebras) for new users until they configure their preferences.
