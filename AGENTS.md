# AGENTS.md What and Why of Ultrahope

Ultrahope is LLM-powered development workflow assistant toolbox. A simple UNIX tool that works with
pipes.

## Why I built Ultrahope

Coding Agents are amazing, but I do not believe the entire development flow should be completed within a single agent.
I also want to combine multiple Coding Agents, and I do not like strongly depending on the features of one specific agent.
I like Unix commands. Even now I build my development flow by combining Unix‑friendly tools like git, gh, jujutsu, and fzf.
I wanted to insert the power of LLMs into that flow.

## Our workspace

The `./.workspace-fs` directory is our working file system. It contains specs under consideration, tasks in progress, and documentation for libraries and frameworks we use.

The three most important items are below. For everything else, see [./.workspace-fs/AGENTS.md](./.workspace-fs/AGENTS.md).

- [state.md](./.workspace-fs/state.md)

    A file that summarizes the current state of the product. It lists key decisions and recent development tasks, and serves as an index with links to related files.

- [to-be/cli.md](./.workspace-fs/to-be/cli.md)

    A document describing the intended target state for the CLI.

- [to-be/api.md](./.workspace-fs/to-be/api.md)

    A document describing the intended target state for the API.

## File Change Workflow

After creating or modifying files, run `mise run format` and fix any reported errors until the check passes cleanly.

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->

## Environment Variables for Scripts

When running scripts that require access tokens or API keys, use `mise -E amp env` to load environment variables:

```bash
eval "$(mise -E amp env)" && <your-command>
```

If authentication or authorization fails due to missing values, please notify the user.

<!-- llms-furl:start -->

## llms-full reference

When working on tasks about a library/framework/runtime/platform, first consult
`llms-furl/`, which contains llms-full.txt split into a tree of leaves — small,
searchable files for quick lookup.

Workflow:
1. Check domains in `llms-furl/AGENTS.md`.
2. Search within the relevant domain (e.g. `rg -n "keyword" llms-furl/bun.sh`).
3. If needed, navigate with `index.json` using `jq`.
4. If no relevant info is found, state that and then move on to other sources.

<!-- llms-furl:end -->