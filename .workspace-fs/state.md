## Design decisions

- Ultrahope provides CLI & API(Private)
- API built by ElysiaJS
- CLI built by TypeScript but framework(authentication, arg parser, logging, observability) is not yet
- CLI authentication with Device Flow
- CLI destributes on npm


## Next

- [ ] Web版 Device verification page (`/device`)
- [ ] ローカルで動作確認 (CLI login → API呼び出し)


## Task (Human)

開発と並行して準備が必要な環境変数:

- [x] **Turso** — `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
    - `turso auth signup` → `turso db create ultrahope` → `turso db tokens create ultrahope`
- [x] **GitHub OAuth** — `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
    - GitHub Settings > Developer settings > OAuth Apps
    - Callback URL: `https://api.ultrahope.dev/auth/callback/github` (本番) / `http://localhost:3000/auth/callback/github` (開発)
- [x] **Resend** — `RESEND_API_KEY`
    - https://resend.com でアカウント作成 → API Keys

後で必要:
- [ ] **Minimax API** — `MINIMAX_API_KEY` (translate実装時)
- [ ] **Polar.sh** — アカウント + プラン設定 (課金実装時)
- [ ] **ドメイン** — ultrahope.dev 等 (デプロイ時)


## Done
- [x] tsc --noEmitを実行できるようにして、error 0にする
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
- [x] 環境変数セットアップ (Turso, GitHub OAuth, Resend)
- [x] DB schema生成 & push (Better Auth CLI + drizzle-kit)
