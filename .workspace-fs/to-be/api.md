# Ultrahope API

> This document represents to-be, not as-is

Base URL: `https://api.ultrahope.dev`

## Authentication

All endpoints except Device Flow require `Authorization: Bearer <token>` header.

### Device Flow

```
POST /v1/auth/device/code
```

Response:
```json
{
  "device_code": "xxx",
  "user_code": "ABCD-1234",
  "verification_uri": "https://ultrahope.dev/device",
  "expires_in": 900,
  "interval": 5
}
```

```
POST /v1/auth/device/token
```

Request:
```json
{
  "device_code": "xxx"
}
```

Response (success):
```json
{
  "access_token": "xxx",
  "token_type": "Bearer"
}
```

Response (pending):
```json
{
  "error": "authorization_pending"
}
```

---

## Translate

```
POST /v1/translate
```

Request:
```json
{
  "input": "<stdin content from pipe>",
  "target": "vcs-commit-message" | "pr-title-body" | "pr-intent",
  "n": 1
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `input` | string | required | Content to translate |
| `target` | string | required | Output format |
| `n` | number | 1 | Number of candidates to generate (1-8) |

Response:
```json
{
  "output": "<translated result>",
  "outputs": ["<candidate 1>", "<candidate 2>", ...]
}
```

- When `n=1`: `output` contains the result, `outputs` is omitted
- When `n>1`: `outputs` contains all candidates, `output` is omitted

### Target Types

| target | input example | output |
|--------|---------------|--------|
| `vcs-commit-message` | `git diff` | Commit message |
| `pr-title-body` | `git log main..HEAD -p` | PR title and body |
| `pr-intent` | `gh pr diff --patch` | Intent/summary of PR |
