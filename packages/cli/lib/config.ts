import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parse } from "smol-toml";
import { DEFAULT_MODELS } from "./vcs-message-generator";

interface CliConfig {
	models?: unknown;
}

const PROJECT_CONFIG_FILENAMES = [".ultrahope.toml", "ultrahope.toml"] as const;

function fail(message: string): never {
	console.error(`Error: ${message}`);
	process.exit(1);
}

function validateModels(models: unknown, sourcePath: string): string[] {
	if (!Array.isArray(models)) {
		fail(
			`Invalid config in ${sourcePath}: models must be an array of strings.`,
		);
	}

	if (models.length === 0) {
		fail(`Invalid config in ${sourcePath}: models must not be empty.`);
	}

	const normalized = models.map((model, index) => {
		if (typeof model !== "string") {
			fail(
				`Invalid config in ${sourcePath}: models[${index}] must be a string.`,
			);
		}
		const trimmed = model.trim();
		if (!trimmed) {
			fail(
				`Invalid config in ${sourcePath}: models[${index}] must not be empty.`,
			);
		}
		return trimmed;
	});

	return normalized;
}

export function parseModelsArg(value: string): string[] {
	const rawModels = value.split(",");
	const models = rawModels.map((m) => m.trim());

	if (models.length === 0 || models.every((m) => m.length === 0)) {
		fail("--models requires at least one non-empty model.");
	}

	const emptyIndex = models.findIndex((m) => m.length === 0);
	if (emptyIndex !== -1) {
		fail(`--models contains an empty value at position ${emptyIndex + 1}.`);
	}

	return models;
}

function getGlobalConfigPath(): string {
	const configDir =
		process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
	return path.join(configDir, "ultrahope", "config.toml");
}

function findNearestProjectConfig(cwd: string): string | null {
	let current = path.resolve(cwd);

	while (true) {
		for (const filename of PROJECT_CONFIG_FILENAMES) {
			const candidate = path.join(current, filename);
			if (fs.existsSync(candidate)) {
				return candidate;
			}
		}

		const parent = path.dirname(current);
		if (parent === current) {
			return null;
		}
		current = parent;
	}
}

function readConfigModels(configPath: string): string[] | undefined {
	let raw = "";
	try {
		raw = fs.readFileSync(configPath, "utf-8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		fail(`Failed to read config file ${configPath}: ${message}`);
	}

	let parsed: CliConfig;
	try {
		parsed = parse(raw) as CliConfig;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		fail(`Failed to parse TOML config ${configPath}: ${message}`);
	}

	if (parsed.models === undefined) {
		return undefined;
	}

	return validateModels(parsed.models, configPath);
}

export function resolveModels(cliModels?: string[]): string[] {
	if (cliModels && cliModels.length > 0) {
		return cliModels;
	}

	const projectConfigPath = findNearestProjectConfig(process.cwd());
	if (projectConfigPath) {
		const projectModels = readConfigModels(projectConfigPath);
		if (projectModels) {
			return projectModels;
		}
	}

	const globalConfigPath = getGlobalConfigPath();
	if (fs.existsSync(globalConfigPath)) {
		const globalModels = readConfigModels(globalConfigPath);
		if (globalModels) {
			return globalModels;
		}
	}

	return DEFAULT_MODELS;
}

export async function ensureGlobalConfigFile(): Promise<void> {
	const configPath = getGlobalConfigPath();
	if (fs.existsSync(configPath)) {
		return;
	}

	const dir = path.dirname(configPath);
	await fs.promises.mkdir(dir, { recursive: true });

	const content = `# Ultrahope CLI configuration\n# https://github.com/toyamarinyon/ultrahope\n\n# Models to use for generation (each model produces one candidate)\n# See available models: https://ultrahope.dev/models\nmodels = ["mistral/ministral-3b", "xai/grok-code-fast-1"]\n`;

	await fs.promises.writeFile(configPath, content, { mode: 0o644, flag: "wx" });
}
