# Update Pricing Page For Pro-Tier Models

## Summary

Update the Pricing page so the new model-tier policy is explained clearly and consistently with the CLI behavior.

## Owner

- Codex + satoshi

## Expected Completion Date

- 2026-03-13

## Next Action

- Completed. Monitor future pricing-copy changes to keep `default` / `pro` tier terminology aligned with docs and CLI messaging.

## Context

The product policy now has two model tiers:

- `default`
- `pro`

Users should understand:

- default CLI generation uses `default` tier models
- escalation switches to `pro` tier models
- Pro-tier model usage requires the Pro plan

The Pricing page should explain this directly so the CLI restriction does not feel surprising.

## Content Goals

- Introduce the two model tiers clearly
- Explain which tier the default CLI experience uses
- Explain that escalation uses Pro-tier models
- Explain that Pro-tier model usage requires the Pro plan
- Keep wording aligned with docs and CLI error messaging

## Acceptance Criteria

- [x] Pricing page explicitly explains `default` and `pro` model tiers
- [x] Pricing page states that escalation uses Pro-tier models
- [x] Pricing page states that Pro-tier models require the Pro plan
- [x] Copy is consistent with CLI docs and product terminology

## Execution Notes

- Updated `packages/web/app/pricing/page.tsx` so the pricing descriptions explain model-tier access inline rather than through a separate panel.
- Added tooltip-triggered explanations on `default model tier` and `Pro-tier models`, each linking to `/models`.
- Refined the tooltip trigger styling from an info icon to dotted-underlined text and fixed hover/focus behavior so the tooltip remains interactive while moving to the link.
- Aligned `packages/web/app/docs/docs.md` escalation terminology with the pricing page by using `default` / `pro` tier language.

## Validation

- Ran `mise run format` successfully after the pricing page changes.
- Verified the tooltip behavior with `agent-browser` on `http://ultrahope.localhost:1355/pricing`.
- Confirmed the tooltip does not open when hovering plain label text, does open from the intended trigger text, stays open while moving to `See models`, and the link navigates to `/models`.
