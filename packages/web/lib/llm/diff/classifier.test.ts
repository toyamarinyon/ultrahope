import { describe, expect, it } from "bun:test";
import { classify } from "./classifier";
import type { DiffRulesConfig, FileDiff } from "./types";

describe("classifier", () => {
	it("promotes primary candidates and groups related files", () => {
		const files: FileDiff[] = [
			{
				path: "src/index.ts",
				type: "modify",
				content: "export function test() {}",
				additions: 10,
				deletions: 2,
			},
			{
				path: "README.md",
				type: "modify",
				content: "update docs",
				additions: 1,
				deletions: 1,
			},
			{
				path: "docs/notes.md",
				type: "add",
				content: "build instructions",
				additions: 1,
				deletions: 0,
			},
		];

		const config: DiffRulesConfig = {
			version: 1,
			rules: [
				{
					id: "primary-source",
					label: "Source",
					match: {
						path: ["src/**"],
					},
					behavior: {
						role: "primary",
						priorityBoost: 3,
					},
				},
				{
					id: "docs",
					label: "Documentation",
					match: {
						path: ["**/*.md"],
					},
					behavior: {
						role: "related",
						priorityBoost: 1,
					},
				},
			],
		};

		const result = classify(files, config);

		expect(result.primary.map((file) => file.path)).toContain("src/index.ts");
		expect(
			result.related.get("Documentation")?.map((file) => file.path),
		).toContain("README.md");
		expect(result.noise).toHaveLength(0);
	});
});
