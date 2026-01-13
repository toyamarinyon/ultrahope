# プロジェクトの構造

## Decision: Single Monorepo + npm files whitelist

**1つのpublic monorepoで、npmにはCLIだけpublish**

```
ultrahope/                    # public repo
  packages/
    cli/                      # npm publish対象
      package.json
      src/
    api/                      # npm publish対象外
      src/
    web/                      # npm publish対象外 (future)
      src/
```

### 仕組み

`packages/cli/package.json` の `files` フィールドでpublish対象を制限:

```json
{
  "name": "ultrahope",
  "files": ["dist"],
  "bin": { "ultrahope": "./dist/index.js" }
}
```

`npm publish` は `packages/cli` ディレクトリからのみ実行。apiやwebはnpmに一切上がらない。

### メリット

- **1つのrepo** - dev server, commit, CI/CDが一元管理
- **コード共有** - 型やユーティリティを `packages/shared` で共有可能
- **CLIだけpublish** - `files` フィールドで制御
- **api/webは非公開** - repoはpublicでもデプロイ先(Fly.io, Vercel等)で環境変数管理
