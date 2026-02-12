import createClient from "openapi-fetch";
import type { paths } from "./api-client.generated";
import { log } from "./logger";

const API_BASE_URL = process.env.ULTRAHOPE_API_URL ?? "https://ultrahope.dev";

export type GenerateRequest =
	paths["/api/v1/commit-message"]["post"]["requestBody"]["content"]["application/json"];

export type GenerateResponse =
	paths["/api/v1/commit-message"]["post"]["responses"][200]["content"]["application/json"];

export type GenerateStreamResponse = {
	output: string;
	cost?: number;
	generationId?: string;
	quota?: { remaining: number; limit: number; resetsAt: string };
};

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

export class InvalidModelError extends Error {
	constructor(
		public model: string,
		public allowedModels: string[],
		message?: string,
	) {
		super(message ?? `Model '${model}' is not supported.`);
		this.name = "InvalidModelError";
	}
}

export type GenerationScoreRequest = {
	generationId: string;
	value: number;
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

export type CommitMessageStreamEvent =
	| { type: "commit-message"; commitMessage: string }
	| {
			type: "usage";
			usage: {
				inputTokens: number;
				outputTokens: number;
				totalTokens?: number;
			};
	  }
	| { type: "provider-metadata"; providerMetadata: unknown }
	| { type: "error"; message: string };

export function extractGatewayMetadata(providerMetadata: unknown): {
	generationId?: string;
	cost?: number;
} {
	const gateway = (providerMetadata as { gateway?: Record<string, unknown> })
		?.gateway;
	if (!gateway) return {};
	const generationId =
		typeof gateway.generationId === "string" ? gateway.generationId : undefined;
	const costValue =
		(typeof gateway.marketCost === "string" && gateway.marketCost) ||
		(typeof gateway.cost === "string" && gateway.cost)
			? String(gateway.marketCost ?? gateway.cost)
			: undefined;
	const cost = costValue ? Number.parseFloat(costValue) : undefined;
	return { generationId, cost };
}

function parseSseEvents(buffer: string): {
	events: CommitMessageStreamEvent[];
	remainder: string;
} {
	const events: CommitMessageStreamEvent[] = [];
	let remainder = buffer;
	while (true) {
		const separatorIndex = remainder.indexOf("\n\n");
		if (separatorIndex === -1) break;
		const rawEvent = remainder.slice(0, separatorIndex);
		remainder = remainder.slice(separatorIndex + 2);
		const lines = rawEvent.split("\n");
		for (const line of lines) {
			if (!line.startsWith("data:")) continue;
			const payload = line.slice(5).trim();
			if (!payload) continue;
			const parsed = JSON.parse(payload) as CommitMessageStreamEvent;
			events.push(parsed);
		}
	}
	return { events, remainder };
}

function handle402Error(error: unknown): never {
	const errorBalance = (error as { balance?: number } | undefined)?.balance;
	if (typeof errorBalance === "number") {
		log("generate error (402 insufficient_balance)", error);
		throw new InsufficientBalanceError(errorBalance);
	}
	const payload = error as
		| { count?: number; limit?: number; resetsAt?: string }
		| undefined;
	const count = typeof payload?.count === "number" ? payload.count : 0;
	const limit = typeof payload?.limit === "number" ? payload.limit : 0;
	const resetsAt = payload?.resetsAt ?? "";
	log("generate error (402 daily_limit)", error);
	throw new DailyLimitExceededError(count, limit, resetsAt);
}

function throwInvalidModelError(error: unknown): never {
	const payload = error as
		| { model?: string; message?: string; allowedModels?: unknown }
		| undefined;
	const message = payload?.message ?? "Model is not supported.";
	const modelMatch = message.match(/Model '([^']+)' is not supported\./);
	const model = payload?.model ?? modelMatch?.[1] ?? "unknown";
	const allowedModels = Array.isArray(payload?.allowedModels)
		? payload.allowedModels.filter(
				(value): value is string => typeof value === "string",
			)
		: [];
	log("generate error (400 invalid_model)", error);
	throw new InvalidModelError(model, allowedModels, message);
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
		async *streamCommitMessage(
			req: GenerateRequest,
			options?: { signal?: AbortSignal },
		): AsyncGenerator<CommitMessageStreamEvent> {
			log("streamCommitMessage request", req);
			const res = await fetch(`${API_BASE_URL}/api/v1/commit-message/stream`, {
				method: "POST",
				headers: {
					...headers,
					Accept: "text/event-stream",
				},
				body: JSON.stringify(req),
				signal: options?.signal,
			});
			if (res.status === 401) {
				log("streamCommitMessage error (401)");
				throw new UnauthorizedError();
			}
			if (res.status === 402) {
				let errorPayload: unknown;
				try {
					errorPayload = await res.json();
				} catch {
					errorPayload = await getErrorText(res, null);
				}
				handle402Error(errorPayload);
			}
			if (res.status === 400) {
				let errorPayload: unknown;
				try {
					errorPayload = await res.json();
				} catch {
					errorPayload = await getErrorText(res, null);
				}
				throwInvalidModelError(errorPayload);
			}
			if (!res.ok) {
				const text = await getErrorText(res, null);
				log("streamCommitMessage error", {
					status: res.status,
					text,
				});
				throw new Error(`API error: ${res.status} ${text}`);
			}
			if (!res.body) {
				throw new Error("API error: empty response body");
			}

			const decoder = new TextDecoder();
			let buffer = "";
			const reader = res.body.getReader();
			try {
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });
					const parsed = parseSseEvents(buffer);
					buffer = parsed.remainder;
					for (const event of parsed.events) {
						yield event;
					}
				}
				buffer += decoder.decode();
				const parsed = parseSseEvents(buffer);
				for (const event of parsed.events) {
					yield event;
				}
			} finally {
				reader.releaseLock();
			}
		},

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

		async generateCommitMessage(
			req: GenerateRequest,
			options?: { signal?: AbortSignal },
		): Promise<GenerateResponse> {
			log("generateCommitMessage request", req);
			const { data, error, response } = await client.POST(
				"/api/v1/commit-message",
				{
					body: req,
					signal: options?.signal,
				},
			);
			if (response.status === 401) {
				log("generateCommitMessage error (401)", error);
				throw new UnauthorizedError();
			}
			if (response.status === 402) {
				handle402Error(error);
			}
			if (response.status === 400) {
				throwInvalidModelError(error);
			}
			if (!response.ok) {
				const text = await getErrorText(response, error);
				log("generateCommitMessage error", { status: response.status, text });
				throw new Error(`API error: ${response.status} ${text}`);
			}
			if (!data) {
				throw new Error("API error: empty response");
			}
			log("generateCommitMessage response", data);
			return data;
		},

		async generateCommitMessageStream(
			req: GenerateRequest,
			options?: { signal?: AbortSignal },
		): Promise<GenerateStreamResponse> {
			let lastCommitMessage = "";
			let providerMetadata: unknown;
			for await (const event of this.streamCommitMessage(req, options)) {
				if (event.type === "commit-message") {
					lastCommitMessage = event.commitMessage;
				} else if (event.type === "provider-metadata") {
					providerMetadata = event.providerMetadata;
				} else if (event.type === "error") {
					throw new Error(event.message);
				}
			}

			if (!lastCommitMessage) {
				throw new Error("API error: empty stream response");
			}

			const { generationId, cost } = extractGatewayMetadata(providerMetadata);
			const result = {
				output: lastCommitMessage,
				cost,
				generationId,
			};
			log("generateCommitMessageStream response", result);
			return result;
		},

		async generatePrTitleBody(
			req: GenerateRequest,
			options?: { signal?: AbortSignal },
		): Promise<GenerateResponse> {
			log("generatePrTitleBody request", req);
			const { data, error, response } = await client.POST(
				"/api/v1/pr-title-body",
				{
					body: req,
					signal: options?.signal,
				},
			);
			if (response.status === 401) {
				log("generatePrTitleBody error (401)", error);
				throw new UnauthorizedError();
			}
			if (response.status === 402) {
				handle402Error(error);
			}
			if (response.status === 400) {
				throwInvalidModelError(error);
			}
			if (!response.ok) {
				const text = await getErrorText(response, error);
				log("generatePrTitleBody error", { status: response.status, text });
				throw new Error(`API error: ${response.status} ${text}`);
			}
			if (!data) {
				throw new Error("API error: empty response");
			}
			log("generatePrTitleBody response", data);
			return data;
		},

		async generatePrIntent(
			req: GenerateRequest,
			options?: { signal?: AbortSignal },
		): Promise<GenerateResponse> {
			log("generatePrIntent request", req);
			const { data, error, response } = await client.POST("/api/v1/pr-intent", {
				body: req,
				signal: options?.signal,
			});
			if (response.status === 401) {
				log("generatePrIntent error (401)", error);
				throw new UnauthorizedError();
			}
			if (response.status === 402) {
				handle402Error(error);
			}
			if (response.status === 400) {
				throwInvalidModelError(error);
			}
			if (!response.ok) {
				const text = await getErrorText(response, error);
				log("generatePrIntent error", { status: response.status, text });
				throw new Error(`API error: ${response.status} ${text}`);
			}
			if (!data) {
				throw new Error("API error: empty response");
			}
			log("generatePrIntent response", data);
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
