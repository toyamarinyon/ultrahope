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

<!-- liffy:start -->

## llms-full reference

When working on tasks about a library/framework/runtime/platform, first consult
`liffy/`, which contains llms-full.txt split into a tree of leaves — small,
searchable files for quick lookup.

Workflow:
1. Check domains in `liffy/AGENTS.md`.
2. Search within the relevant domain (e.g. `rg -n "keyword" liffy/bun.sh`).
3. If needed, navigate with `index.json` using `jq`.
4. If no relevant info is found, state that and then move on to other sources.

<!-- liffy:end -->