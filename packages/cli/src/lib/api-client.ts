import type { LLMResponse, Target } from "@ultrahope/core";
import { log } from "./logger";

const API_BASE_URL = process.env.ULTRAHOPE_API_URL ?? "https://ultrahope.dev";

export type { Target };

export interface TranslateRequest {
	input: string;
	target: Target;
}

export type TranslateResponse = LLMResponse & { output: string };

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

	return {
		async translate(req: TranslateRequest): Promise<TranslateResponse> {
			log("translate request", req);
			const res = await fetch(`${API_BASE_URL}/api/v1/translate`, {
				method: "POST",
				headers,
				body: JSON.stringify(req),
			});
			if (!res.ok) {
				if (res.status === 402) {
					const data = await res.json();
					log("translate error (402)", data);
					throw new InsufficientBalanceError(data.balance ?? 0);
				}
				const text = await res.text();
				log("translate error", { status: res.status, text });
				throw new Error(`API error: ${res.status} ${text}`);
			}
			const data = await res.json();
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
