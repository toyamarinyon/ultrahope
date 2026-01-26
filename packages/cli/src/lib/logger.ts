import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG_DIR = join(homedir(), ".local", "state", "ultrahope");
const LOG_FILE = join(LOG_DIR, "log");

let initialized = false;

function ensureLogDir(): void {
	if (initialized) return;
	try {
		mkdirSync(LOG_DIR, { recursive: true });
		initialized = true;
	} catch {
		// Ignore errors
	}
}

export function log(message: string, data?: unknown): void {
	ensureLogDir();
	const timestamp = new Date().toISOString();
	const line = data
		? `[${timestamp}] ${message}: ${JSON.stringify(data, null, 2)}\n`
		: `[${timestamp}] ${message}\n`;
	try {
		appendFileSync(LOG_FILE, line);
	} catch {
		// Ignore write errors
	}
}
