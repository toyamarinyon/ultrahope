# Web Package

## Decision

`packages/web` を Next.js で作成する。

## Context

Ultrahope のユーザー体験フロー:
1. Product Hunt や X で Ultrahope を知る
2. Website に来る
3. 使ってみたいと思う
4. アカウント作成
5. CLI ダウンロード
6. Device Flow で認証

## Why Next.js

- **アカウント管理** — サインアップ、ログイン、プロフィール
- **決済フロー** — Polar.sh 連携
- **Device Flow** — `/device` 認証ページ
- **API Playground** — API を試せるインタラクティブな UI
- **SSR/動的機能** — 上記の要件で静的サイトでは不十分

Astro も検討したが、動的な機能が多いため Next.js を採用。

## Scope

- Landing page
- `/device` — Device Flow 認証ページ
- Pricing / 決済
- Docs
- API Playground
- アカウント管理
