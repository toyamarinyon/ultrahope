# Node.js TTY Menu/Prompt Resume Bug: Why `readline` Can Drop Input on Return

**Date:** 2026-02-28  
**Package:** `@ultrahope/cli` (`packages/cli`)  
**Scope:** Node.js standard APIs (`process.stdin` / `process.stdout` / `readline` / `tty`)

---

## What can go wrong

If you build a CLI with a menu in raw mode and open `readline` prompts for a sub-flow, returning from the prompt to the menu can leave stdin unreadable.

In our case, the sequence was:

- Menu is running in raw mode with a keypress handler
- Enter inline prompt (edit/refine-like flow)
- Exit prompt with `Esc` and return to menu
- Process exits or the menu seems unresponsive immediately after returning

The key symptom is that prompt close logs appear, but no `tty` keypress events are handled after returning.

---

## Root cause

After closing a `readline` interface, the underlying `stdin`/TTY state is not always restored in a way that guarantees new events are read immediately.

The key is this: toggling listeners and `setRawMode(true)` is not enough by itself. You also need an explicit resume on stdin.

`isPaused()` checks can be unreliable here because the stream can still miss resumed event intake in practice even when the paused flag does not reflect the problematic state.

---

## Minimal fix (state transition pattern)

In your menu/prompt transition helper (e.g., `withPromptSuspended`), do this on return from prompt:

1. Remove raw-mode menu keypress handlers before opening prompt.
2. Restore `stdin` to prompt mode and run prompt.
3. After prompt closes:
   - add the menu keypress handler back
   - apply raw mode
   - **call `resume()` unconditionally**

```ts
const withPromptSuspended = async (task: () => Promise<void>) => {
  if (isPromptOpen || cleanedUp) return;
  isPromptOpen = true;
  setRawModeSafe(false);
  ttyReader.removeListener("keypress", handleKeypress);

  await task();
  if (cleanedUp) return;

  isPromptOpen = false;
  ttyReader.resume(); // Required. No isPaused() guard.
  ttyReader.on("keypress", handleKeypress);
  setRawModeSafe(true);
};
```

The critical line is `ttyReader.resume()` without conditionals.

---

## What was validated

- Using `Esc` as the return key did show up as residual events sometimes, but that was not the core issue for this failure.
- The most direct regression signal was: removing `resume` caused the menu not to receive new input after prompt close.
- This issue is reproducible in a small standalone TTY/menu/prompt repro and disappears with the unconditional resume.

The most important success criterion: **after returning from prompt, menu keypress logs should continue immediately.**

---

## Repro idea (copy/paste)

Below is a minimal, self-contained sample. It mirrors a `Menu -> Prompt -> Menu` flow and keeps behavior easy to paste into a note/blog post:

```ts
import * as readline from "node:readline";
import * as tty from "node:tty";

const ttyInput = process.stdin as tty.ReadStream;
const ttyOutput = process.stdout as tty.WriteStream;

readline.emitKeypressEvents(ttyInput);
ttyInput.setRawMode(true);

let inPrompt = false;

const onMenuKeypress = async (_: string, key: readline.Key) => {
  if (inPrompt) return;

  if (key.name === "e") {
    await withPromptSuspended(async () => {
      await openPrompt();
    });
  }

  if (key.name === "q") {
    process.exit(0);
  }
};

const withPromptSuspended = async (task: () => Promise<void>) => {
  if (inPrompt) return;

  inPrompt = true;
  ttyInput.removeListener("keypress", onMenuKeypress);
  ttyInput.setRawMode(false);

  try {
    await task();
  } finally {
    inPrompt = false;
    ttyInput.resume(); // This is the fix.
    readline.emitKeypressEvents(ttyInput);
    ttyInput.on("keypress", onMenuKeypress);
    ttyInput.setRawMode(true);
  }
};

const openPrompt = async () => {
  return new Promise<void>((resolve) => {
    const rl = readline.createInterface({
      input: ttyInput,
      output: ttyOutput,
      terminal: true,
    });

    const closePrompt = () => {
      ttyInput.off("keypress", onPromptKeypress);
      rl.close();
      resolve();
    };

    const onPromptKeypress = (_: string, key: readline.Key) => {
      if (key.name === "escape") closePrompt();
      if (key.name === "c" && key.ctrl) {
        process.exit(0);
      }
    };

    rl.setPrompt("> ");
    rl.prompt();
    rl.on("line", closePrompt);
    rl.on("close", closePrompt);
    ttyInput.on("keypress", onPromptKeypress);
  });
};

ttyInput.on("keypress", onMenuKeypress);
```

If menu key handling fails right after returning, the first thing to check is whether `ttyInput.resume()` exists and is not conditionally skipped.

