# CLI Implementation Plan

> This document represents implementation decisions for Ultrahope CLI

## Framework Selection

### Recommended: custom thin wrapper (no framework)

**Why:**
- Only two commands (`translate`, `login`)
- No need for complex nesting or subcommand chains
- Parsing `process.argv` can be done in a few dozen lines
- Fewer dependencies and smaller bundle size
- cmd-ts is good, but overkill at this scale

**Implementation approach:**
- Parse `process.argv` directly
- Ensure type safety with custom parser functions
- Keep error handling simple and local

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
  "dependencies": {}
}
```

No external CLI framework needed.

## Implementation Details

### Entry Point

```typescript
#!/usr/bin/env node
import { translate } from './commands/translate';
import { login } from './commands/login';

const [command, ...args] = process.argv.slice(2);

switch (command) {
  case 'translate':
    await translate(args);
    break;
  case 'login':
    await login(args);
    break;
  case '--help':
  case '-h':
  case undefined:
    printHelp();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

function printHelp() {
  console.log(`Usage: ultrahope <command>

Commands:
  translate  Translate input to various formats
  login      Authenticate with device flow`);
}
```

### Translate Command

```typescript
type Target = 'vcs-commit-message' | 'pr-title-body' | 'pr-intent';

export async function translate(args: string[]) {
  const target = parseTarget(args);
  const input = await readStdin();
  const result = await apiClient.translate({ input, target });
  console.log(result.output);
}

function parseTarget(args: string[]): Target {
  const idx = args.findIndex(a => a === '--target' || a === '-t');
  if (idx === -1 || !args[idx + 1]) {
    console.error('Missing --target option');
    process.exit(1);
  }
  const value = args[idx + 1];
  if (!['vcs-commit-message', 'pr-title-body', 'pr-intent'].includes(value)) {
    console.error(`Invalid target: ${value}`);
    process.exit(1);
  }
  return value as Target;
}
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
