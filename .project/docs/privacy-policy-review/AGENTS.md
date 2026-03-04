# Privacy Policy Review — Edit Workflow

When editing `privacy-policy-review.md`, always follow this workflow to keep the file consistent.

## Workflow

1. **Read the entire file first.** Never edit a section in isolation — the Progress table and Issue sections must stay in sync.

2. **Update the Issue section.** Make your changes to the relevant Issue block:
   - Change the status label in the `####` heading (e.g., `⬜ TODO` → `🔧 IN PROGRESS`).
   - Fill in or update the `**Resolution:**` section with a concise record of what was done, including links to commits, PRs, or files changed.

3. **Update the Progress table.** After changing any Issue, update the matching row in the Progress table so the Status column matches the heading.

4. **Update the top-level Status.** If all issues are ✅ DONE or ⏭️ DEFERRED, change `**Status:**` to `🟢 Complete`. Otherwise keep it as `🔴 In Progress`.

5. **Write the full file.** Use `create_file` (not `edit_file` with partial matches) to rewrite the entire file. This avoids partial-update drift between the Progress table and Issue sections.

## Status Values

| Emoji | Meaning |
|-------|---------|
| ⬜ | TODO — not started |
| 🔧 | IN PROGRESS — work underway |
| ✅ | DONE — resolved and verified |
| ⏭️ | DEFERRED — intentionally postponed with reason noted in Resolution |

## Rules

- Never change the Issue `#` numbers — they are stable identifiers referenced elsewhere.
- When marking an issue ✅ DONE, the Resolution section **must** contain a summary of what was done.
- When marking an issue ⏭️ DEFERRED, the Resolution section **must** explain why.
- Do not remove issues from the file; only change their status.
