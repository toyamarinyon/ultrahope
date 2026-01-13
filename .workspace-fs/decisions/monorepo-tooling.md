# Monorepo Tooling

## Decision: Bun Workspaces

**Bun workspacesでmonorepoを管理し、CLIはNode向けにビルドしてnpm publish**

### 理由

- ElysiaJSがBunネイティブ → API開発でBunを使う
- Bun workspacesはnpm/pnpm互換の `workspaces` フィールドを使用
- `bun build --target node` でNode.js向けバイナリを生成可能
- ツールチェーンを統一することで複雑さを減らす

### 構成

```
ultrahope/
  package.json          # workspaces: ["packages/*"]
  bun.lock
  packages/
    cli/                # bun build --target node → npm publish
    api/                # Bun native (ElysiaJS)
    shared/             # 共有型・ユーティリティ (future)
```

### CLIビルド

```bash
cd packages/cli
bun build ./src/index.ts --outdir ./dist --target node
npm publish
```

### 参考

- https://bun.sh/docs/install/workspaces
- https://bun.sh/docs/bundler
