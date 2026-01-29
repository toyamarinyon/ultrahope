import createClient from "openapi-fetch";
import type { paths } from "./api-client.generated";
import { log } from "./logger";

const API_BASE_URL = process.env.ULTRAHOPE_API_URL ?? "https://ultrahope.dev";

export type TranslateRequest =
	paths["/api/v1/translate"]["post"]["requestBody"]["content"]["application/json"];

export type TranslateResponse =
	paths["/api/v1/translate"]["post"]["responses"][200]["content"]["application/json"];

export type CommandExecutionRequest =
	paths["/api/v1/command_execution"]["post"]["requestBody"]["content"]["application/json"];

export type CommandExecutionResponse =
	paths["/api/v1/command_execution"]["post"]["responses"][200]["content"]["application/json"];

export class InsufficientBalanceError extends Error {
	constructor(public balance: number) {
		super("Token balance exhausted");
		this.name = "InsufficientBalanceError";
	}
}

export class DailyLimitExceededError extends Error {
	constructor(
		public count: number,
		public limit: number,
		public resetsAt: string,
	) {
		super("Daily request limit reached");
		this.name = "DailyLimitExceededError";
	}
}

export class UnauthorizedError extends Error {
	constructor() {
		super("Unauthorized");
		this.name = "UnauthorizedError";
	}
}

export type GenerationScoreRequest = {
	generationId: string;
	value: number;
	comment?: string | null;
};

async function getErrorText(
	response: Response,
	error: unknown,
): Promise<string> {
	if (error) {
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}
	try {
		return await response.text();
	} catch (readError) {
		return `Failed to read response body: ${
			readError instanceof Error ? readError.message : String(readError)
		}`;
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
		async recordGenerationScore(req: GenerationScoreRequest): Promise<void> {
			log("generation_score request", req);
			const res = await fetch(`${API_BASE_URL}/api/v1/generation_score`, {
				method: "POST",
				headers,
				body: JSON.stringify(req),
			});
			if (!res.ok) {
				const text = await getErrorText(res, null);
				log("generation_score error", { status: res.status, text });
				throw new Error(`API error: ${res.status} ${text}`);
			}
		},

		async commandExecution(
			req: CommandExecutionRequest,
		): Promise<CommandExecutionResponse> {
			log("command_execution request", req);
			const { data, error, response } = await client.POST(
				"/api/v1/command_execution",
				{
					body: req,
				},
			);
			if (response.status === 401) {
				log("command_execution error (401)", error);
				throw new UnauthorizedError();
			}
			if (response.status === 402) {
				const payload = error as
					| { count?: number; limit?: number; resetsAt?: string }
					| undefined;
				const count = typeof payload?.count === "number" ? payload.count : 0;
				const limit = typeof payload?.limit === "number" ? payload.limit : 0;
				const resetsAt = payload?.resetsAt ?? "";
				log("command_execution error (402)", error);
				throw new DailyLimitExceededError(count, limit, resetsAt);
			}
			if (!response.ok) {
				const text = await getErrorText(response, error);
				log("command_execution error", { status: response.status, text });
				throw new Error(`API error: ${response.status} ${text}`);
			}
			if (!data) {
				throw new Error("API error: empty response");
			}
			log("command_execution response", data);
			return data;
		},

		async translate(
			req: TranslateRequest,
			options?: { signal?: AbortSignal },
		): Promise<TranslateResponse> {
			log("translate request", req);
			const { data, error, response } = await client.POST("/api/v1/translate", {
				body: req,
				signal: options?.signal,
			});
			if (response.status === 401) {
				log("translate error (401)", error);
				throw new UnauthorizedError();
			}
			if (response.status === 402) {
				const errorBalance = (error as { balance?: number } | undefined)
					?.balance;
				const balance = typeof errorBalance === "number" ? errorBalance : 0;
				log("translate error (402)", error);
				throw new InsufficientBalanceError(balance);
			}
			if (!response.ok) {
				const text = await getErrorText(response, error);
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
