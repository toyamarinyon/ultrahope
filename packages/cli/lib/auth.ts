import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createApiClient } from "./api-client";

export type AuthKind = "anonymous" | "authenticated";

interface Credentials {
	access_token: string;
	auth_kind?: AuthKind;
	installation_id?: string;
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
	installationId: string;
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
			installationId: await ensureInstallationId(creds),
		};
	} catch {
		return null;
	}
}

async function writeCredentials(creds: Credentials): Promise<void> {
	const credPath = getCredentialsPath();
	const dir = path.dirname(credPath);

	await fs.promises.mkdir(dir, { recursive: true });
	await fs.promises.writeFile(credPath, JSON.stringify(creds, null, 2), {
		mode: 0o600,
	});
}

async function ensureInstallationId(
	creds: Credentials | null,
): Promise<string> {
	if (creds?.installation_id && creds.installation_id.length > 0) {
		return creds.installation_id;
	}

	const installationId = randomUUID();
	await writeCredentials({
		access_token: creds?.access_token ?? "",
		auth_kind: creds?.auth_kind,
		installation_id: installationId,
	});
	return installationId;
}

export async function getInstallationId(): Promise<string> {
	const credPath = getCredentialsPath();
	try {
		const content = await fs.promises.readFile(credPath, "utf-8");
		const creds: Credentials = JSON.parse(content);
		return await ensureInstallationId(creds);
	} catch {
		return await ensureInstallationId(null);
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
	const installationId = await getInstallationId();
	await writeCredentials({
		access_token: token,
		auth_kind: authKind,
		installation_id: installationId,
	});
}
