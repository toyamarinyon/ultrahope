# AGENTS.md What and Why of Ultrahope

Ultrahope is LLM-powered development workflow assistant toolbox. A simple UNIX tool that works with
pipes.

## Why I built Ultrahope

Coding Agentはすごい、でも開発フローの全てがそこで完結するとは思っていない。
また、いろいろなCoding Agentを組み合わせたいので、特定のCoding Agentの機能に強く依存するのも好きじゃない。
私は、unixコマンドが好きだ。今もgit, gh, jujutsu, fzfいろいろなunix friendlyなツールを組み合わせて開発フローを構築している。
ここにLLMの力を挟みたいと思った。

## Our workspace

`./.workspace-fs` ディレクトリは私たちの作業ファイルシステムです。検討中の仕様や、実装中のタスク、その他利用するライブラリ、フレームワークのドキュメントなどがあります。

特に重要なものは以下の3つです。あとは [./.workspace-fs/AGENTS.md](./.workspace-fs/AGENTS.md) を参照してください。

- [state.md](./.workspace-fs/state.md)

    このプロダクトの現在の状態をまとめたファイルです。重要な意思決定や直近の開発タスクがまとまっています。関連するファイルへのリンクもあるindexファイルです。

- [to-be/cli.md](./.workspace-fs/to-be/cli.md)

    cliのあるべき姿を記述したファイルです。

- [to-be/api.md](./.workspace-fs/to-be/api.md)

    apiのあるべき姿を記述したファイルです。

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

When running scripts that require access tokens or API keys, use `MISE_ENV=amp` before the command:

```bash
MISE_ENV=amp <your-command>
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