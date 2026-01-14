## Design decisions

- Ultrahope provides CLI & API(Private)
- API built by ElysiaJS
- CLI built by TypeScript but framework(authentication, arg parser, logging, observability) is not yet
- CLI authentication with Device Flow
- CLI destributes on npm


## Next
- [ ] 環境変数をセットしてローカルで動作確認
- [ ] DB schema生成 (`bunx @better-auth/cli generate`)
- [ ] Web版 Device verification page (`/device`)


## Task (Human)

開発と並行して準備が必要な環境変数:

- [ ] **Turso** — `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
    - `turso auth signup` → `turso db create ultrahope` → `turso db tokens create ultrahope`
- [ ] **GitHub OAuth** — `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
    - GitHub Settings > Developer settings > OAuth Apps
    - Callback URL: `https://api.ultrahope.dev/auth/callback/github` (本番) / `http://localhost:3000/auth/callback/github` (開発)
- [ ] **Resend** — `RESEND_API_KEY`
    - https://resend.com でアカウント作成 → API Keys

後で必要:
- [ ] **Minimax API** — `MINIMAX_API_KEY` (translate実装時)
- [ ] **Polar.sh** — アカウント + プラン設定 (課金実装時)
- [ ] **ドメイン** — ultrahope.dev 等 (デプロイ時)


## Done
- [x] コードフォーマット & dead code検出の仕組み導入 (Biome + knip)
- [x] 決済について → [decisions/billing.md](decisions/billing.md) (Polar.sh採用)
- [x] 認証の実装方法について → [decisions/authentication.md](decisions/authentication.md) (Better Auth採用)
- [x] CLIのto-beからAPIサーバーの設計を考える → [to-be/api.md](to-be/api.md)
- [x] CLIの実装方法を考える → [decisions/cli-implementation.md](decisions/cli-implementation.md)
- [x] CLIの実装方法を再考: cmd-ts → 自作の薄いラッパーに変更
- [x] プロジェクトの構成について考える → [decisions/project-structure.md](decisions/project-structure.md)
- [x] `.workspace-fs` の構造を整理
- [x] インフラ選定 → [decisions/infrastructure.md](decisions/infrastructure.md) (Vercel + Turso + Minimax + Resend)
- [x] プロジェクト初期化 (Bun workspaces + packages/cli, packages/api)
- [x] API実装 (Better Auth + Device Flow + translate endpoint)
- [x] CLI実装 (translate, login コマンド)
