import createClient from "openapi-fetch";
import type { paths } from "./api-client.generated";
import { log } from "./logger";

const API_BASE_URL = process.env.ULTRAHOPE_API_URL ?? "https://ultrahope.dev";

export type TranslateRequest =
	paths["/api/v1/translate"]["post"]["requestBody"]["content"]["application/json"];

export type TranslateResponse =
	paths["/api/v1/translate"]["post"]["responses"][200]["content"]["application/json"];

export class InsufficientBalanceError extends Error {
	constructor(public balance: number) {
		super("Token balance exhausted");
		this.name = "InsufficientBalanceError";
	}
}

interface DeviceCodeResponse {
	device_code: string;
	user_code: string;
	verification_uri: string;
	expires_in: number;
	interval: number;
}

interface TokenResponse {
	access_token?: string;
	token_type?: string;
	error?: string;
}

export function createApiClient(token?: string) {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	const client = createClient<paths>({
		baseUrl: API_BASE_URL,
		headers,
	});

	return {
		async translate(req: TranslateRequest): Promise<TranslateResponse> {
			log("translate request", req);
			const { data, error, response } = await client.POST("/api/v1/translate", {
				body: req,
			});
			if (response.status === 402) {
				const balance =
					typeof (error as { balance?: number } | undefined)?.balance ===
					"number"
						? (error as { balance?: number }).balance
						: 0;
				log("translate error (402)", error);
				throw new InsufficientBalanceError(balance);
			}
			if (!response.ok) {
				const text = await response.text();
				log("translate error", { status: response.status, text });
				throw new Error(`API error: ${response.status} ${text}`);
			}
			if (!data) {
				throw new Error("API error: empty response");
			}
			log("translate response", data);
			return data;
		},

		async requestDeviceCode(): Promise<DeviceCodeResponse> {
			const res = await fetch(`${API_BASE_URL}/api/auth/device/code`, {
				method: "POST",
				headers,
				body: JSON.stringify({ client_id: "ultrahope-cli" }),
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(`API error: ${res.status} ${text}`);
			}
			return res.json();
		},

		async pollDeviceToken(deviceCode: string): Promise<TokenResponse> {
			const res = await fetch(`${API_BASE_URL}/api/auth/device/token`, {
				method: "POST",
				headers,
				body: JSON.stringify({
					grant_type: "urn:ietf:params:oauth:grant-type:device_code",
					device_code: deviceCode,
					client_id: "ultrahope-cli",
				}),
			});
			if (!res.ok && res.status !== 400) {
				const text = await res.text();
				throw new Error(`API error: ${res.status} ${text}`);
			}
			return res.json();
		},
	};
}
