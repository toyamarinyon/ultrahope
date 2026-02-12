import { createApiClient } from "../lib/api-client";
import { saveToken } from "../lib/auth";
import { ensureGlobalConfigFile } from "../lib/config";

export async function login(_args: string[]) {
	const api = createApiClient();

	console.log("Requesting device code...");
	const deviceCode = await api.requestDeviceCode();

	console.log();
	console.log(`Open this URL in your browser: ${deviceCode.verification_uri}`);
	console.log(`Enter code: ${deviceCode.user_code}`);
	console.log();
	console.log("Waiting for authorization...");

	const token = await pollForToken(
		api,
		deviceCode.device_code,
		deviceCode.interval,
		deviceCode.expires_in,
	);

	await saveToken(token);
	await ensureGlobalConfigFile();
	console.log("Successfully authenticated!");
}

async function pollForToken(
	api: ReturnType<typeof createApiClient>,
	deviceCode: string,
	interval: number,
	expiresIn: number,
): Promise<string> {
	const deadline = Date.now() + expiresIn * 1000;

	while (Date.now() < deadline) {
		await sleep(interval * 1000);

		const result = await api.pollDeviceToken(deviceCode);
		if (result.access_token) {
			return result.access_token;
		}
		if (result.error && result.error !== "authorization_pending") {
			throw new Error(`Authentication failed: ${result.error}`);
		}
	}

	throw new Error("Authentication timed out");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
