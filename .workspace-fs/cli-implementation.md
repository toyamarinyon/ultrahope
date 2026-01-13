# CLI Implementation Plan

> This document represents implementation decisions for Ultrahope CLI

## Framework Selection

### Recommended: `cmd-ts`

**Why cmd-ts:**
- Type-safe argument parsing (types flow into handler)
- Built-in validation with nice error messages
- Easy stdin pipe handling
- Simple composition for subcommands
- Lightweight, modern design

**Alternatives considered:**
- `commander` - Popular but `any` land, no type safety
- `yargs` - Heavy, complex API
- `oclif` - Overkill for simple CLI
- `citty` - Good but less mature ecosystem

## Project Structure

```
packages/
  cli/
    src/
      index.ts          # Entry point
      commands/
        translate.ts    # translate command
        login.ts        # login command
      lib/
        api-client.ts   # HTTP client for API
        auth.ts         # Token storage/retrieval
        config.ts       # Config file handling
    package.json
    tsconfig.json
```

## Dependencies

```json
{
  "dependencies": {
    "cmd-ts": "^0.13.0"
  }
}
```

## Implementation Details

### Entry Point

```typescript
import { binary, run, subcommands } from 'cmd-ts';
import { translate } from './commands/translate';
import { login } from './commands/login';

const app = subcommands({
  name: 'ultrahope',
  cmds: { translate, login }
});

run(binary(app), process.argv);
```

### Translate Command

```typescript
import { command, option, string } from 'cmd-ts';
import { stdin } from './lib/stdin';

export const translate = command({
  name: 'translate',
  args: {
    target: option({
      type: string,
      long: 'target',
      short: 't',
      description: 'Target format: vcs-commit-message | pr-title-body | pr-intent'
    })
  },
  async handler({ target }) {
    const input = await stdin();
    const result = await apiClient.translate({ input, target });
    console.log(result.output);
  }
});
```

### Stdin Handling

```typescript
export async function stdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
```

### Auth Token Storage

Store token in `~/.config/ultrahope/credentials.json`:

```json
{
  "access_token": "xxx"
}
```

## Build & Distribution

- Build with `tsup` or `esbuild` for single executable
- Publish to npm as `ultrahope`
- Add `bin` field in package.json:

```json
{
  "bin": {
    "ultrahope": "./dist/index.js"
  }
}
```
