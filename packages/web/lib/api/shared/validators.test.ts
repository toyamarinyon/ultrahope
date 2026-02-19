import { describe, expect, it } from "bun:test";
import { ALLOWED_MODEL_IDS } from "@/lib/llm/models";
import {
	GenerateBodySchema,
	invalidModelErrorBody,
	isModelAllowed,
} from "./validators";

describe("validators", () => {
	it("accepts known model identifiers", () => {
		expect(isModelAllowed(ALLOWED_MODEL_IDS[0])).toBe(true);
	});

	it("rejects unknown model identifiers", () => {
		expect(isModelAllowed("unknown-model-id")).toBe(false);
	});

	it("builds invalid model error payload", () => {
		expect(invalidModelErrorBody("not-a-model")).toEqual({
			error: "invalid_model",
			message: "Model 'not-a-model' is not supported.",
			allowedModels: ALLOWED_MODEL_IDS,
		});
	});

	it("exports request schema with required fields", () => {
		expect(GenerateBodySchema.properties?.input?.type).toBe("string");
	});
});
