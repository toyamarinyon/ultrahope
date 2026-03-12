# Update Pricing Page For Pro-Tier Models

## Summary

Update the Pricing page so the new model-tier policy is explained clearly and consistently with the CLI behavior.

## Owner

- Codex + satoshi

## Expected Completion Date

- 2026-03-13

## Next Action

- Review the current Pricing page copy and add explicit messaging for `default` vs `pro` model tiers and the fact that escalation uses Pro-tier models.

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

- [ ] Pricing page explicitly explains `default` and `pro` model tiers
- [ ] Pricing page states that escalation uses Pro-tier models
- [ ] Pricing page states that Pro-tier models require the Pro plan
- [ ] Copy is consistent with CLI docs and product terminology

