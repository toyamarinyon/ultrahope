import { describe, expect, it } from "bun:test";
import { isGitDiff, parseDiff } from "./parser";

describe("parser", () => {
	it("detects unified diff format", () => {
		expect(
			isGitDiff(`diff --git a/src/index.ts b/src/index.ts
index 123..456 100644`),
		).toBe(true);
		expect(isGitDiff("just some random text")).toBe(false);
	});

	it("parses file changes with type and counts", () => {
		const input = `diff --git a/src/a.ts b/src/a.ts
index 111..222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,3 @@
 line one
+added
-removed`;

		const files = parseDiff(input);

		expect(files).toHaveLength(1);
		expect(files[0]?.path).toBe("src/a.ts");
		expect(files[0]?.oldPath).toBeUndefined();
		expect(files[0]?.type).toBe("modify");
		expect(files[0]?.additions).toBe(1);
		expect(files[0]?.deletions).toBe(1);
	});
});
