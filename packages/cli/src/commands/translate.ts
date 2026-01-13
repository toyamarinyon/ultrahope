import { stdin } from "../lib/stdin";
import { createApiClient } from "../lib/api-client";
import { getToken } from "../lib/auth";

type Target = "vcs-commit-message" | "pr-title-body" | "pr-intent";

const VALID_TARGETS: Target[] = ["vcs-commit-message", "pr-title-body", "pr-intent"];

export async function translate(args: string[]) {
  const target = parseTarget(args);
  const input = await stdin();

  if (!input.trim()) {
    console.error("Error: No input provided. Pipe content to ultrahope translate.");
    process.exit(1);
  }

  const token = await getToken();
  if (!token) {
    console.error("Error: Not authenticated. Run `ultrahope login` first.");
    process.exit(1);
  }

  const api = createApiClient(token);
  const result = await api.translate({ input, target });
  console.log(result.output);
}

function parseTarget(args: string[]): Target {
  const idx = args.findIndex((a) => a === "--target" || a === "-t");
  if (idx === -1 || !args[idx + 1]) {
    console.error("Error: Missing --target option");
    console.error("Usage: ultrahope translate --target <vcs-commit-message|pr-title-body|pr-intent>");
    process.exit(1);
  }
  const value = args[idx + 1];
  if (!VALID_TARGETS.includes(value as Target)) {
    console.error(`Error: Invalid target "${value}"`);
    console.error(`Valid targets: ${VALID_TARGETS.join(", ")}`);
    process.exit(1);
  }
  return value as Target;
}
