import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createApiClient } from "./api-client";

export type AuthKind = "anonymous" | "authenticated";

interface Credentials {
	access_token: string;
	auth_kind?: AuthKind;
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

export async function getCredentials(): Promise<{
	accessToken: string;
	authKind: AuthKind;
} | null> {
	const credPath = getCredentialsPath();
	try {
		const content = await fs.promises.readFile(credPath, "utf-8");
		const creds: Credentials = JSON.parse(content);
		if (
			typeof creds.access_token !== "string" ||
			creds.access_token.length === 0
		) {
			return null;
		}
		return {
			accessToken: creds.access_token,
			authKind: creds.auth_kind === "anonymous" ? "anonymous" : "authenticated",
		};
	} catch {
		return null;
	}
}

export async function getToken(): Promise<string> {
	const existing = await getCredentials();
	if (existing) {
		return existing.accessToken;
	}

	const api = createApiClient();
	const anonymousSession = await api.signInAnonymous();
	await saveToken(anonymousSession.token, "anonymous");
	return anonymousSession.token;
}

export async function saveToken(
	token: string,
	authKind: AuthKind = "authenticated",
): Promise<void> {
	const credPath = getCredentialsPath();
	const dir = path.dirname(credPath);

	await fs.promises.mkdir(dir, { recursive: true });
	await fs.promises.writeFile(
		credPath,
		JSON.stringify({ access_token: token, auth_kind: authKind }, null, 2),
		{ mode: 0o600 },
	);
}
