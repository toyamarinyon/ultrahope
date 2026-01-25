import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

interface Credentials {
	access_token: string;
}

function getCredentialsPath(): string {
	const configDir =
		process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
	const env = process.env.ULTRAHOPE_ENV;
	const filename =
		env && env !== "production"
			? `credentials.${env}.json`
			: "credentials.json";
	return path.join(configDir, "ultrahope", filename);
}

export async function getToken(): Promise<string | null> {
	const credPath = getCredentialsPath();
	try {
		const content = await fs.promises.readFile(credPath, "utf-8");
		const creds: Credentials = JSON.parse(content);
		return creds.access_token ?? null;
	} catch {
		return null;
	}
}

export async function saveToken(token: string): Promise<void> {
	const credPath = getCredentialsPath();
	const dir = path.dirname(credPath);

	await fs.promises.mkdir(dir, { recursive: true });
	await fs.promises.writeFile(
		credPath,
		JSON.stringify({ access_token: token }, null, 2),
		{ mode: 0o600 },
	);
}
