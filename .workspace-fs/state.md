## Design decisions

- Ultrahope provides CLI & API(Private)
- API built by ElysiaJS
- CLI built by TypeScript but framework(authentication, arg parser, logging, observability) is not yet
- CLI authentication with Device Flow
- CLI destributes on npm


## Next
- [ ] プロジェクト初期化 (monorepo setup, packages/cli, packages/api)
- [ ] API実装 (ElysiaJS)
- [ ] CLI実装 (自作の薄いラッパー)


## Done
- [x] CLIのto-beからAPIサーバーの設計を考える → [to-be/api.md](to-be/api.md)
- [x] CLIの実装方法を考える → [decisions/cli-implementation.md](decisions/cli-implementation.md)
- [x] CLIの実装方法を再考: cmd-ts → 自作の薄いラッパーに変更
- [x] プロジェクトの構成について考える → [decisions/project-structure.md](decisions/project-structure.md)
- [x] `.workspace-fs` の構造を整理
