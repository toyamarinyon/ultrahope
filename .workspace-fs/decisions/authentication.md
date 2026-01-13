# 認証の実装方針

## 結論: Better Auth を採用

### 理由

1. **Device Flow ネイティブサポート**
   - [Device Authorization Plugin](https://www.better-auth.com/docs/plugins/device-authorization) でRFC 8628準拠のDevice Flowを完全サポート
   - CLIでの`better-auth login`コマンドがデモとして提供されており、まさにUltrahopeのユースケースと一致

2. **GitHub Login + Magic Link の両対応**
   - GitHub OAuth: 組み込みの[GitHub Provider](https://www.better-auth.com/docs/authentication/github.md)
   - Magic Link: [Magic Link Plugin](https://www.better-auth.com/docs/plugins/magic-link.md)

3. **ElysiaJS統合**
   - [Elysia Integration](https://www.better-auth.com/docs/integrations/elysia.md) が公式サポート

4. **将来のWeb版への拡張**
   - CLI/API/Webで同じ認証基盤を共有可能
   - Bearer Token Plugin でAPI認証にも対応

5. **セルフホスト**
   - Supabase Authと異なり、自前のAPIサーバーに組み込み可能
   - データベースも自由に選択可能

## アーキテクチャ

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│   CLI           │     │  API Server (ElysiaJS + Better Auth)│
│                 │     │                                     │
│  1. device/code ├────►│  POST /v1/auth/device/code          │
│                 │◄────┤  → device_code, user_code           │
│                 │     │                                     │
│  2. ブラウザで  │     │  /device (verification page)        │
│     認証        │     │  → GitHub Login or Magic Link       │
│                 │     │                                     │
│  3. polling     ├────►│  POST /v1/auth/device/token         │
│                 │◄────┤  → access_token (Bearer)            │
│                 │     │                                     │
│  4. API呼び出し ├────►│  POST /v1/translate                 │
│  Bearer token   │◄────┤  → translated result                │
└─────────────────┘     └─────────────────────────────────────┘
```

## 実装ステップ

### API側 (packages/api)

1. Better Auth セットアップ
```typescript
import { betterAuth } from 'better-auth'
import { deviceAuthorization } from 'better-auth/plugins/device-authorization'
import { magicLink } from 'better-auth/plugins/magic-link'

export const auth = betterAuth({
  database: /* PostgreSQL or SQLite */,
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  plugins: [
    deviceAuthorization({
      verificationUri: '/device',
      expiresIn: '30m',
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // メール送信処理
      },
    }),
  ],
})
```

2. ElysiaJS統合
```typescript
import { Elysia } from 'elysia'
import { auth } from './auth'

const app = new Elysia()
  .mount('/auth', auth.handler)
  .post('/v1/translate', /* ... */, {
    beforeHandle: async ({ request }) => {
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) throw new Error('Unauthorized')
    }
  })
```

### CLI側 (packages/cli)

```typescript
async function login() {
  // 1. Device code取得
  const res = await fetch(`${API_URL}/auth/device/code`, {
    method: 'POST',
    body: JSON.stringify({ client_id: 'ultrahope-cli' }),
  })
  const { device_code, user_code, verification_uri } = await res.json()
  
  // 2. ユーザーに表示
  console.log(`Open ${verification_uri} and enter code: ${user_code}`)
  await open(verification_uri)
  
  // 3. Polling
  while (true) {
    const tokenRes = await fetch(`${API_URL}/auth/device/token`, {
      method: 'POST',
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code,
        client_id: 'ultrahope-cli',
      }),
    })
    const data = await tokenRes.json()
    if (data.access_token) {
      saveToken(data.access_token) // ~/.ultrahope/credentials に保存
      break
    }
    await sleep(5000)
  }
}
```

### Web版 (将来)

同じBetter Authインスタンスを使用し、Cookie-basedセッションで認証。CLIで取得したトークンとWebセッションは同じユーザーに紐づく。

## Supabase Authとの比較

| 観点 | Better Auth | Supabase Auth |
|------|-------------|---------------|
| Device Flow | ✅ Plugin | ❌ 未サポート |
| セルフホスト | ✅ 完全 | △ Supabase依存 |
| ElysiaJS統合 | ✅ 公式 | △ 要カスタム |
| Magic Link | ✅ Plugin | ✅ 組み込み |
| GitHub OAuth | ✅ 組み込み | ✅ 組み込み |

## 参考

- [Better Auth Device Authorization](https://www.better-auth.com/docs/plugins/device-authorization)
- [RFC 8628: OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628)
- [Better Auth Elysia Integration](https://www.better-auth.com/docs/integrations/elysia)
