# .workspace-fs Structure

```
.workspace-fs/
├── state.md         # Index: 現在の状態、Next/Done、他ファイルへのリンク
├── to-be/           # 仕様: 何を作るか (as-isではなくto-be)
│   ├── cli.md
│   └── api.md
├── decisions/       # 意思決定: どう作るか、なぜそうしたか (ADR的)
│   ├── authentication.md
│   ├── billing.md
│   ├── cli-implementation.md
│   ├── infrastructure.md
│   ├── project-structure.md
│   ├── monorepo-tooling.md
│   └── web-package.md
└── docs/            # 外部ドキュメント: 参照用のライブラリ/フレームワーク情報
    └── elysiajs/
```

## Naming conventions

- **to-be/** — 「あるべき姿」。現状(as-is)ではなく目指す仕様を書く
- **decisions/** — 技術選定や設計判断の記録。後から「なぜこうしたか」を追える
- **docs/** — 外部リソースのローカルコピー。LLMが参照しやすい形式で保存

## docs/

- [docs/elysiajs/llms-full.txt](docs/elysiajs/llms-full.txt) — API実装に利用するElysiaJSの情報
