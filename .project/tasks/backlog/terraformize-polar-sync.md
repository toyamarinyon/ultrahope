# Terraformize `polar-sync`

Owner: satoshi

## Motivation

`./scripts/polar-sync.ts` already behaves like a small desired-state reconciler, but it still relies on human-facing fields such as `name` and `description` to identify remote Polar resources.

That creates Terraform-unfriendly behavior:

- Renames can look like create-orphan operations instead of updates
- `dry-run` is implemented as branching inside imperative sync logic, not as a first-class plan
- Drift detection, action selection, and execution are tightly coupled
- Resource lifecycle policy for unmanaged/legacy objects is implicit

If this script is intended to be the long-term source of truth for Polar billing resources, it should move closer to a Terraform-style architecture: stable identity, explicit diffing, and plan/apply separation.

## Current state

- Resources are discovered and indexed by display fields:
  - Benefits by `description`
  - Products by `name`
  - Meters by `name`
- Desired state is embedded directly in the script as `CONFIG`
- Sync functions both compute diffs and perform side effects
- `--dry-run` logs planned actions, but there is no reusable action plan object
- Fixed-price updates are now supported in place, but the surrounding architecture is still imperative

## Goal

Refactor `./scripts/polar-sync.ts` into a stable desired-state engine that:

1. identifies managed Polar resources by machine-stable metadata rather than display strings,
2. computes a reusable execution plan before mutating anything,
3. makes lifecycle policy explicit for create/update/recreate/archive/no-op cases,
4. keeps the implementation lightweight and code-first, without introducing actual Terraform.

## Non-goals

- Do not adopt external Terraform/OpenTofu as the runtime for Polar management
- Do not change billing product semantics during this refactor
- Do not build a general-purpose framework beyond Polar billing resources

## Proposed design

### 1. Stable resource identity via metadata

Use Polar resource metadata for managed identity on meters, benefits, and products.

Example metadata contract:

- `managed_by: "ultrahope"`
- `resource_kind: "meter" | "benefit" | "product"`
- `resource_key: "<config key>"`

Display fields (`name`, `description`) remain editable and no longer serve as identity.

### 2. Split desired state, discovery, diff, and apply

Break the current script into explicit stages:

1. `desired-state`
   - data-only config for meters, benefits, products, one-time products
2. `discover`
   - fetch Polar resources and index managed ones by metadata key
3. `diff`
   - produce typed actions such as `create`, `update`, `recreate`, `archive`, `noop`
4. `render-plan`
   - print deterministic dry-run output from the action list
5. `apply`
   - execute the exact action list produced by diff

### 3. Explicit lifecycle policy

Document and encode per-resource behavior:

- `rename` => update, not recreate
- fixed-price amount change => update in place where supported
- incompatible price topology change => recreate
- legacy/unmanaged resources => warn only by default
- old managed resources missing from desired state => explicit policy (`warn` now, archive later if wanted)

### 4. Testable action planner

Move the core reconciler into pure functions with focused tests:

- metadata-based lookup
- rename handling
- update vs recreate decisions
- orphaned managed resource detection
- dry-run plan rendering

## Tasks

### Task 1: Introduce metadata identity

- Add metadata fields to desired-state definitions
- Create/update Polar meters, benefits, and products with `managed_by` and `resource_key`
- Change discovery to index managed resources by metadata instead of display strings

Acceptance criteria:

- [ ] Renaming a product or benefit does not create a duplicate managed resource
- [ ] Managed resources can be looked up without relying on `name` or `description`

### Task 2: Extract desired state from the executor

- Move `CONFIG` into a data-only module such as `./scripts/polar/desired-state.ts`
- Keep executor code free of embedded product specifics

Acceptance criteria:

- [ ] Desired state can be imported independently of execution
- [ ] Sync logic can operate on any compatible desired-state input

### Task 3: Introduce typed plan actions

- Define a typed action model:
  - `CreateMeter`
  - `UpdateBenefit`
  - `UpdateProductPrices`
  - `RecreateProduct`
  - `ArchiveProduct`
  - `Noop`
- Refactor diffing to return actions instead of branching directly on `ctx.dryRun`

Acceptance criteria:

- [ ] `dry-run` output is generated from the same action list used by apply
- [ ] Apply path does not recompute business decisions differently from plan

### Task 4: Make lifecycle policy explicit

- Encode policy for unmanaged legacy resources and deleted managed resources
- Add clear CLI output describing policy decisions
- Keep default behavior conservative: warn, do not delete/archive unmanaged resources automatically

Acceptance criteria:

- [ ] The script distinguishes managed vs unmanaged remote resources
- [ ] Missing-from-config managed resources are surfaced explicitly in plan output

### Task 5: Add focused reconciler tests

- Add unit tests for metadata lookup, rename behavior, action planning, recreate conditions, and orphan detection

Acceptance criteria:

- [ ] Core plan logic is covered by pure-function tests
- [ ] Renames and description changes are verified as updates rather than implicit creates

## Suggested module layout

```text
scripts/polar/
  desired-state.ts
  types.ts
  discover.ts
  diff.ts
  apply.ts
  render-plan.ts
scripts/polar-sync.ts
```

`scripts/polar-sync.ts` should remain a thin CLI entrypoint that wires these modules together.

## Verification

```bash
mise run format
bun test ./scripts/polar-sync.test.ts
mise -E amp exec -- bun run scripts:run -- polar-sync --dry-run --server sandbox
```

Manual validation goals:

- rename a managed benefit/product in desired state and confirm dry-run shows `update`, not `create`
- change a fixed price and confirm dry-run shows in-place `update`
- remove a managed resource from desired state and confirm plan surfaces it as unmanaged/orphaned according to policy

## Related files

- `./scripts/polar-sync.ts`
- `./.project/decisions/billing-model-v2.md`
- `./.project/docs/polar/oat.md`

## Next action

Start with Task 1 and Task 3 together: add metadata identity and return typed plan actions before splitting files further.
