import { t } from "elysia";
import { ALLOWED_MODEL_IDS, isAllowedModelId } from "@/lib/llm/models";

export type InvalidModelBody = {
	error: "invalid_model";
	message: string;
	allowedModels: readonly string[];
};

export const GenerateBodySchema = t.Object({
	cliSessionId: t.String(),
	input: t.String(),
	model: t.String(),
	guide: t.Optional(t.String()),
});

export const CommandExecutionBodySchema = t.Object({
	commandExecutionId: t.String(),
	cliSessionId: t.String(),
	command: t.String(),
	args: t.Array(t.String()),
	api: t.String(),
	requestPayload: t.Object({
		input: t.String(),
		target: t.Union([
			t.Literal("vcs-commit-message"),
			t.Literal("pr-title-body"),
			t.Literal("pr-intent"),
		]),
		model: t.Optional(t.String()),
		models: t.Optional(t.Array(t.String())),
		guide: t.Optional(t.String()),
	}),
});

export const GenerationScoreBodySchema = t.Object({
	generationId: t.String(),
	value: t.Number(),
});

export const GenerateSuccessResponseSchema = t.Object({
	output: t.String(),
	content: t.String(),
	vendor: t.String(),
	model: t.String(),
	inputTokens: t.Number(),
	outputTokens: t.Number(),
	cachedInputTokens: t.Optional(t.Number()),
	cost: t.Optional(t.Number()),
	generationId: t.String(),
	quota: t.Optional(
		t.Object({
			remaining: t.Number(),
			limit: t.Number(),
			resetsAt: t.String(),
		}),
	),
});

export const GenerateErrorResponseSchemas = {
	400: t.Object({
		error: t.Literal("invalid_model"),
		message: t.String(),
		allowedModels: t.Array(t.String()),
	}),
	401: t.Object({
		error: t.String(),
	}),
	402: t.Union([
		t.Object({
			error: t.Literal("daily_limit_exceeded"),
			message: t.String(),
			count: t.Number(),
			limit: t.Number(),
			resetsAt: t.String(),
			plan: t.Literal("free"),
			actions: t.Object({
				upgrade: t.String(),
			}),
			hint: t.String(),
		}),
		t.Object({
			error: t.Literal("insufficient_balance"),
			message: t.String(),
			balance: t.Number(),
			plan: t.Union([t.Literal("free"), t.Literal("pro")]),
			actions: t.Object({
				buyCredits: t.String(),
			}),
			hint: t.String(),
		}),
		t.Object({
			error: t.Literal("billing_unavailable"),
			message: t.String(),
		}),
	]),
};

export const CommandExecutionResponseSchemas = {
	200: t.Object({
		commandExecutionId: t.String(),
	}),
	401: t.Object({
		error: t.String(),
	}),
	402: t.Union([
		t.Object({
			error: t.Literal("daily_limit_exceeded"),
			message: t.String(),
			count: t.Number(),
			limit: t.Number(),
			resetsAt: t.String(),
			plan: t.Literal("free"),
			actions: t.Object({
				upgrade: t.String(),
			}),
			hint: t.String(),
		}),
		t.Object({
			error: t.Literal("insufficient_balance"),
			message: t.String(),
			balance: t.Number(),
			plan: t.Union([t.Literal("free"), t.Literal("pro")]),
			actions: t.Object({
				buyCredits: t.String(),
			}),
			hint: t.String(),
		}),
	]),
};

export function isModelAllowed(model: string): boolean {
	return isAllowedModelId(model);
}

export function invalidModelErrorBody(model: string): InvalidModelBody {
	return {
		error: "invalid_model",
		message: `Model '${model}' is not supported.`,
		allowedModels: ALLOWED_MODEL_IDS,
	};
}
