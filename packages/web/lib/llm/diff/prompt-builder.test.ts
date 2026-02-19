import { describe, expect, it } from "bun:test";
import { buildStructuredPrompt } from "./prompt-builder";
import type { ClassificationResult, ClassifiedFile } from "./types";

describe("prompt-builder", () => {
	it("builds a prompt with primary and related sections", () => {
		const primary: ClassifiedFile = {
			path: "src/index.ts",
			type: "modify",
			content: "export function index() {}",
			additions: 10,
			deletions: 1,
			ruleId: "source",
			label: "Source",
			role: "primary",
			omit: false,
			isPrimary: true,
		};

		const related: ClassifiedFile = {
			path: "README.md",
			type: "add",
			content: "Documentation update",
			additions: 1,
			deletions: 0,
			ruleId: "docs",
			label: "Docs",
			role: "related",
			omit: true,
			isPrimary: false,
		};

		const result = buildStructuredPrompt({
			primary: [primary],
			related: new Map([["Docs", [related]]]),
			noise: [],
		});

		expect(result).toContain("## Primary Changes (src/index.ts)");
		expect(result).toContain("## Related: Docs");
		expect(result).toContain("README.md (add, +1 -0)");
	});
});
