import { randomUUID } from "node:crypto";
import { z } from "zod";

/**
 * Vercel AI Gateway provider metadata schema.
 *
 * Based on: https://vercel.com/docs/ai-gateway/models-and-providers/provider-options
 * See "Example provider metadata output" section.
 */

const GatewayRoutingAttemptSchema = z.object({
	provider: z.string(),
	internalModelId: z.string(),
	providerApiModelId: z.string(),
	credentialType: z.enum(["system", "byok"]),
	success: z.boolean(),
	error: z.string().optional(),
	startTime: z.number(),
	endTime: z.number(),
});

const GatewayModelAttemptSchema = z.object({
	modelId: z.string(),
	canonicalSlug: z.string(),
	success: z.boolean(),
	providerAttemptCount: z.number(),
	providerAttempts: z.array(GatewayRoutingAttemptSchema),
});

const GatewayRoutingSchema = z.object({
	originalModelId: z.string(),
	resolvedProvider: z.string(),
	resolvedProviderApiModelId: z.string(),
	internalResolvedModelId: z.string(),
	fallbacksAvailable: z.array(z.string()),
	internalReasoning: z.string(),
	planningReasoning: z.string(),
	canonicalSlug: z.string(),
	finalProvider: z.string(),
	attempts: z.array(GatewayRoutingAttemptSchema),
	modelAttemptCount: z.number(),
	modelAttempts: z.array(GatewayModelAttemptSchema),
	totalProviderAttemptCount: z.number(),
});

const GatewayMetadataSchema = z.object({
	routing: GatewayRoutingSchema,
	cost: z.string(),
	marketCost: z.string(),
	generationId: z.string(),
});

const GatewayProviderMetadataSchema = z
	.object({
		gateway: GatewayMetadataSchema,
	})
	.loose();

function generateFallbackId(): string {
	return `fallback-${randomUUID()}`;
}

/**
 * Extracts gateway metadata with validation.
 * Logs warnings if the metadata doesn't match expected schema.
 */
export function extractGatewayMetadata(providerMetadata: unknown): {
	generationId: string;
	cost: number | undefined;
	vendor: string;
} {
	const result = GatewayProviderMetadataSchema.safeParse(providerMetadata);

	if (result.success) {
		const { gateway } = result.data;
		const costStr = gateway.marketCost ?? gateway.cost;
		const cost = costStr ? Number.parseFloat(costStr) : undefined;
		const successfulAttempt = gateway.routing.attempts.find(
			(attempt) => attempt.success,
		);
		const vendor = successfulAttempt?.provider ?? "unknown";

		return { generationId: gateway.generationId, cost, vendor };
	}

	for (const issue of result.error.issues) {
		const path = issue.path.join(".");
		console.warn(`[gateway-metadata] ${path}: ${issue.message}`);
	}

	return {
		generationId: generateFallbackId(),
		cost: undefined,
		vendor: "unknown",
	};
}
