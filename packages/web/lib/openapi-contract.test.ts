import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { app } from "./api";

type OpenapiDocument = {
	paths: Record<
		string,
		{
			[method: string]: {
				responses?: Record<string, unknown>;
			};
		}
	>;
};

function extractResponseCodes(route: {
	responses?: Record<string, unknown>;
}): string[] {
	return route.responses ? Object.keys(route.responses).sort() : [];
}

describe("openapi contract", () => {
	it("matches tracked endpoint status code map", async () => {
		const expected = JSON.parse(
			readFileSync(new URL("../openapi.json", import.meta.url), "utf8"),
		) as OpenapiDocument;
		const response = await app.handle(
			new Request("http://localhost/api/openapi/json"),
		);
		const actual = (await response.json()) as OpenapiDocument;

		const trackedPaths = {
			"/api/v1/command_execution": ["post"],
			"/api/v1/commit-message": ["post"],
			"/api/v1/commit-message/stream": ["post"],
			"/api/v1/pr-title-body": ["post"],
			"/api/v1/pr-intent": ["post"],
			"/api/v1/generation_score": ["post"],
			"/api/health": ["get"],
		} as const;

		for (const [path, methods] of Object.entries(trackedPaths)) {
			expect(actual.paths[path], `missing path ${path}`).toBeDefined();
			for (const method of methods) {
				const expectedRoute = expected.paths[path]?.[method];
				const actualRoute = actual.paths[path]?.[method];
				expect(
					expectedRoute,
					`missing route ${method.toUpperCase()} ${path}`,
				).toBeDefined();
				expect(
					actualRoute,
					`missing generated route ${method.toUpperCase()} ${path}`,
				).toBeDefined();

				const expectedCodes = extractResponseCodes(expectedRoute!).sort();
				for (const status of expectedCodes) {
					expect(
						actualRoute?.responses?.[status],
						`missing ${path} ${method.toUpperCase()} response ${status}`,
					).toBeDefined();
				}
			}
		}
	});
});
