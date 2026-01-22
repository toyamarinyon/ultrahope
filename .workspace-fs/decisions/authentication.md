# Authentication implementation policy

## Conclusion: adopt Better Auth

### Reasons

1. **Native Device Flow support**
   - The [Device Authorization Plugin](https://www.better-auth.com/docs/plugins/device-authorization) fully supports RFC 8628 Device Flow
   - The CLI demo `better-auth login` aligns directly with Ultrahope’s use case

2. **Supports both GitHub Login + Magic Link**
   - GitHub OAuth: built-in [GitHub Provider](https://www.better-auth.com/docs/authentication/github.md)
   - Magic Link: [Magic Link Plugin](https://www.better-auth.com/docs/plugins/magic-link.md)

3. **ElysiaJS integration**
   - Official support via [Elysia Integration](https://www.better-auth.com/docs/integrations/elysia.md)

4. **Future Web expansion**
   - Share the same auth foundation across CLI/API/Web
   - Bearer Token Plugin also supports API auth

5. **Self-hosted**
   - Unlike Supabase Auth, it can be embedded in our own API server
   - Database choice is flexible

## Architecture

```
┌─────────────────┐     ┌─────────────────────────────────────┐
│   CLI           │     │  API Server (ElysiaJS + Better Auth)│
│                 │     │                                     │
│  1. device/code ├────►│  POST /v1/auth/device/code          │
│                 │◄────┤  → device_code, user_code           │
│                 │     │                                     │
│  2. Browser     │     │  /device (verification page)        │
│     auth        │     │  → GitHub Login or Magic Link       │
│                 │     │                                     │
│  3. polling     ├────►│  POST /v1/auth/device/token         │
│                 │◄────┤  → access_token (Bearer)            │
│                 │     │                                     │
│  4. API call    ├────►│  POST /v1/translate                 │
│  Bearer token   │◄────┤  → translated result                │
└─────────────────┘     └─────────────────────────────────────┘
```

## Implementation steps

### API side (packages/api)

1. Better Auth setup
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
        // Send email
      },
    }),
  ],
})
```

2. ElysiaJS integration
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

### CLI side (packages/cli)

```typescript
async function login() {
  // 1. Get device code
  const res = await fetch(`${API_URL}/auth/device/code`, {
    method: 'POST',
    body: JSON.stringify({ client_id: 'ultrahope-cli' }),
  })
  const { device_code, user_code, verification_uri } = await res.json()
  
  // 2. Show to the user
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
      saveToken(data.access_token) // Save to ~/.ultrahope/credentials
      break
    }
    await sleep(5000)
  }
}
```

### Web version (future)

Use the same Better Auth instance and authenticate via cookie-based sessions. The CLI token and Web session map to the same user.

## Comparison with Supabase Auth

| Aspect | Better Auth | Supabase Auth |
|------|-------------|---------------|
| Device Flow | ✅ Plugin | ❌ Not supported |
| Self-hosted | ✅ Full | △ Depends on Supabase |
| ElysiaJS integration | ✅ Official | △ Requires customization |
| Magic Link | ✅ Plugin | ✅ Built-in |
| GitHub OAuth | ✅ Built-in | ✅ Built-in |

## References

- [Better Auth Device Authorization](https://www.better-auth.com/docs/plugins/device-authorization)
- [RFC 8628: OAuth 2.0 Device Authorization Grant](https://datatracker.ietf.org/doc/html/rfc8628)
- [Better Auth Elysia Integration](https://www.better-auth.com/docs/integrations/elysia)
