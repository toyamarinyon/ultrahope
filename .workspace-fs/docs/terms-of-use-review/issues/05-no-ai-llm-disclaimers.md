# Issue #5: No mention of AI/LLM or disclaimers about generated content

**Priority:** HIGH
**Status:** ⬜ TODO

## Problem

**Terms state:** Nothing about AI, machine learning, or automated content generation.

**Reality:** The core of the service is AI-powered content generation using third-party LLM providers (Mistral, xAI) via Vercel AI Gateway. This is a significant omission because:

1. **Accuracy disclaimer needed:** AI-generated commit messages and PR descriptions may be inaccurate, misleading, or inappropriate. Users should be informed they are responsible for reviewing AI output before using it.
2. **Third-party AI processing:** User code diffs are sent to third-party AI providers for processing. This should be disclosed.
3. **No guarantee of output quality:** LLM outputs are non-deterministic. The terms should set expectations.
4. **Model changes:** The service may change AI models at any time (currently `mistral/ministral-3b` and `xai/grok-code-fast-1`), affecting output quality and characteristics.

**Relevant code:**
- `packages/web/lib/api.ts:150-230` — LLM generation logic
- `packages/web/lib/models.ts` — Model configuration
- `packages/web/lib/prompt.ts` — System prompts for AI generation

## Recommended Action

Add a dedicated section covering:
- The service uses AI/LLM to generate content
- User code is processed by third-party AI providers
- AI output may be inaccurate and user is responsible for review
- Models and providers may change without notice
- No guarantee of specific output quality or consistency

## Resolution

<!-- When resolved, update status above and fill in details here -->
