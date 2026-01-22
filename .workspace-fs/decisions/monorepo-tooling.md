# Monorepo Tooling

## Decision: pnpm Workspaces

**pnpm workspacesでmonorepoを管理し、CLIはNode向けにビルドしてnpm publish**

### 理由

- VercelのBun Runtime依存を避け、Node.jsランタイムに統一する
- pnpmはnpm互換の `workspaces` フィールドを利用できる
- tsupでNode.js向けに単一ファイル出力できる
- ツールチェーンを統一することで複雑さを減らす

### 構成

```
ultrahope/
  package.json          # workspaces: ["packages/*"]
  pnpm-workspace.yaml
  pnpm-lock.yaml
  packages/
    cli/                # tsup build → npm publish
    web/                # Next.js + ElysiaJS API
    shared/             # 共有型・ユーティリティ (future)
```

### CLIビルド

```bash
cd packages/cli
pnpm run build
npm publish
```

### 参考

- https://pnpm.io/workspaces
- https://tsup.egoist.dev/
