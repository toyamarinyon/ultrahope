# commit-message-benchmark

Offline-friendly benchmark dataset generator for the marketing comparison demo.

## What it does

- Loads 3 fixed React diffs from `fixtures/react/`.
- Runs commit-message generation across 8 configured models via AI Gateway.
- Writes dataset JSON to:
  - `packages/web/lib/demo/commit-message-benchmark.dataset.json`
- Preserves existing `humanReview` fields on regeneration.
- Reuses existing scenario/model results from the output dataset to avoid regenerating already-computed models.
- Keeps per-model failures as `status: "error"` instead of aborting the entire run.

## Run

```bash
bun --cwd packages/commit-message-benchmark run generate
```

Options:

- `--set <name>` load fixtures from `fixtures/<name>/` (default: `react`)
- `--repo <owner>/<repo>` load fixtures from `fixtures/github/<owner>/<repo>/`
- `--github-all` load all fixtures under `fixtures/github/*/*/`
- `--model <id>` regenerate only one model (example: `xai/grok-code-fast-1`)

Examples:

```bash
# Run only fixtures/github/vercel/next.js
bun --cwd packages/commit-message-benchmark run generate --repo vercel/next.js

# Run all repositories under fixtures/github
bun --cwd packages/commit-message-benchmark run generate --github-all

# Rerun only the Grok model on github fixtures
bun --cwd packages/commit-message-benchmark run generate --set github --model xai/grok-code-fast-1
```

## Add a scenario from a GitHub commit URL

```bash
bun --cwd packages/commit-message-benchmark run add --url https://github.com/<owner>/<repo>/commit/<sha>
```

Options:

- `--id <scenario-id>` custom scenario id
- `--title <title>` custom scenario title
- `--overwrite` replace existing entry with the same id
- `--dry-run` fetch and validate without writing files

This command writes:

- unified diff to `fixtures/github/<owner>/<repo>/<commit-sha>/diff.diff`
- commit metadata to `fixtures/github/<owner>/<repo>/<commit-sha>/metadata.json`
- index entry to `fixtures/github/<owner>/<repo>/index.json`

Metadata JSON includes commit message, sha, author/committer, stats, changed file list, and source URLs for later processing.

## Environment

- `AI_GATEWAY_API_KEY` (required for live generation)
- Optional: `BENCH_MAX_CONCURRENCY` (default: `3`)
- Optional for higher GitHub API limits when using `add`: `GITHUB_TOKEN` or `GH_TOKEN`

If `AI_GATEWAY_API_KEY` is missing, generation still completes but results are recorded as errors.

## Human review workflow

`humanReview` is intentionally preserved between runs.

1. Run generator once.
2. Edit `humanReview.overallScore` / `notes` / `winnerFlag` in the dataset JSON.
3. Re-run generator; manual reviews remain intact.
