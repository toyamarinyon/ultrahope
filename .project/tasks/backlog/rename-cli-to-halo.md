# Rename CLI product to Halo

Owner: satoshi

Context:
- `ultrahope.dev` should become the root for Satoshi's personal site, activities, writing, and future work.
- The current `ultrahope.dev` CLI product is well made and should be preserved, but the current user base is small enough that a rename is acceptable.
- The new CLI product name is `Halo`.
- Product-facing names and in-site text should be renamed from Ultrahope to Halo where they refer to the CLI product.
- External service names and identifiers, including Polar configuration, do not need to be renamed as part of this task.

Product direction:
- `Ultrahope` is the parent brand / home.
- `Halo` is the CLI product under Ultrahope.
- The core promise remains: turn a diff into commit message candidates in the terminal, then let the user compare, edit, refine, or escalate before committing.

Scope:
- Rename CLI product copy in README, docs, marketing pages, metadata, and help text.
- Introduce Halo command/package naming for the primary install and usage path.
- Keep the existing Ultrahope CLI experience available as a compatibility path during migration.
- Move or redesign the current CLI marketing surface so it can live under the future `ultrahope.dev` personal/root site without losing the current product page.

Acceptance criteria:
- [x] Primary product name in CLI-facing README/docs/marketing text is `Halo`.
- [x] The main install command uses the new package name, likely `npm i -g @ultrahope/halo` unless a different package strategy is chosen.
- [x] Primary Git command examples use `git halo commit`.
- [x] Primary Jujutsu command examples use `jj halo describe` and `jj halo commit`.
- [x] `halo jj setup` registers the `jj halo` alias.
- [x] Legacy commands continue to work during migration: `ultrahope`, `git ultrahope`, `git hope`, and `git uh`.
- [x] Help text clearly points legacy command users toward Halo without breaking existing workflows.
- [x] Config and credential migration strategy is documented before changing paths such as `~/.config/ultrahope` or `.ultrahope.toml`.
- [x] Environment variable strategy is documented before changing `ULTRAHOPE_API_URL`.
- [x] API/backend internals may keep Ultrahope identifiers where changing them would create unnecessary risk.
- [x] Polar product/customer/subscription configuration names are left unchanged unless there is a separate operational reason to rename them.
- [ ] Current CLI product page content remains available after `ultrahope.dev` becomes the personal/activity/writing root, for example under `/halo` or `/tools/halo`.
- [ ] SEO metadata, Open Graph text, docs navigation, pricing links, and footer links reflect the new Halo product naming.
- [ ] Release notes or migration notes explain the rename and the supported compatibility commands.

Suggested implementation notes:
- Treat this as a product rename first, not a full internal namespace migration.
- Prefer a staged migration:
  1. Add Halo names, package metadata, command aliases, and docs.
  2. Keep Ultrahope aliases and config paths working.
  3. Publish Halo package.
  4. Update the website information architecture so `ultrahope.dev` can become the root site.
  5. Optionally deprecate legacy package/commands later, after observing usage.
- Consider whether `@ultrahope/halo` should be the canonical npm package, with `ultrahope` becoming a compatibility package.
- Consider keeping `ULTRAHOPE_API_URL` as the stable internal env var initially, even if docs introduce `HALO_API_URL` later.
- Consider keeping `~/.config/ultrahope` and `.ultrahope.toml` initially to avoid surprising current installs; add `halo` config paths only with explicit fallback behavior.

Related links:
- `./README.md`
- `./packages/cli/README.md`
- `./packages/cli/package.json`
- `./packages/cli/index.ts`
- `./packages/cli/git-ultrahope.ts`
- `./packages/cli/commands/jj.ts`
- `./packages/web/components/marketing-home.tsx`
- `./packages/web/app/docs/docs.md`
- `./packages/web/app/pricing/page.tsx`
- `./packages/web/app/models/page.tsx`

related_decisions:
- `./.project/decisions/halo-cli-rename-migration-strategy.md`

Execution notes:
- 2026-04-30: Added a proposed migration strategy covering command compatibility, package naming, config/credential paths, environment variables, backend/external-service boundaries, web IA, and release notes.
- 2026-04-30: Implemented first rename pass for CLI/docs/marketing surfaces with Halo as primary (`@ultrahope/halo`, `halo`, `git halo commit`, `jj halo ...`) while preserving compatibility commands and legacy config/env paths.
- 2026-04-30: Follow-up fixes: updated stale `bun.lock` workspace entries for `@ultrahope/halo`, removed accidental `.codex/agents/*` artifacts, fixed `jj.ts` formatting, expanded legacy git subcommand detection (`git-ultrahope`, `git-hope`, `git-uh`), and re-checked acceptance criteria status.

Next action:
- Complete remaining unchecked migration items: move CLI product surface under a dedicated route (for example `/halo`), finish full SEO/Open Graph/docs-nav/pricing/footer naming pass, and add release/migration notes for Halo + compatibility commands.
