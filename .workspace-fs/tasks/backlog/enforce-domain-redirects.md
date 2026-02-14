# Enforce canonical domain redirect behavior

Owner: satoshi

Context:
- Redirect behavior between http/https and www/non-www variants should be explicit before launch.

Acceptance criteria:
- Define canonical domain policy (e.g. https + preferred host).
- Ensure all variants redirect with 301 where expected.
- Verify login and pricing URLs preserve path and query correctly.
- Add a quick pre-launch check script or checklist for domain routing.

Next action:
- Configure edge/server redirect rules and validate manually on staging before public rollout.
