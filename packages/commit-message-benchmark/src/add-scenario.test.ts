import { describe, expect, it } from "bun:test";
import {
	buildCommitArtifactFiles,
	createScenarioId,
	parseGitHubCommitUrl,
	resolveUniqueId,
	slugify,
} from "./add-scenario";

describe("add-scenario helpers", () => {
	it("parses GitHub commit URL", () => {
		const parsed = parseGitHubCommitUrl(
			"https://github.com/facebook/react/commit/4f8977c4267ea0df9f58f7f42b35f79ece6de251?foo=bar",
		);
		expect(parsed.owner).toBe("facebook");
		expect(parsed.repo).toBe("react");
		expect(parsed.sha).toBe("4f8977c4267ea0df9f58f7f42b35f79ece6de251");
		expect(parsed.diffUrl.endsWith(".diff")).toBe(true);
	});

	it("rejects non-commit GitHub URLs", () => {
		expect(() =>
			parseGitHubCommitUrl("https://github.com/facebook/react/pull/1"),
		).toThrow("Invalid GitHub commit URL");
	});

	it("slugifies free-form text", () => {
		expect(slugify("Fix: Input defaultChecked sync!!!")).toBe(
			"fix-input-defaultchecked-sync",
		);
		expect(slugify("   ")).toBe("");
	});

	it("creates deterministic scenario ids", () => {
		const id = createScenarioId({
			repo: "react",
			sha: "abcdef1234567890",
			message: "Fix uncontrolled input defaultChecked sync\n\nbody",
		});
		expect(id).toBe(
			"react-abcdef12-fix-uncontrolled-input-defaultchecked-sync",
		);
	});

	it("resolves unique ids with numeric suffix", () => {
		const resolved = resolveUniqueId({
			baseId: "react-sample",
			existingIds: new Set(["react-sample", "react-sample-2"]),
			allowExisting: false,
		});
		expect(resolved).toBe("react-sample-3");
	});

	it("keeps id when overwrite is enabled", () => {
		const resolved = resolveUniqueId({
			baseId: "react-sample",
			existingIds: new Set(["react-sample"]),
			allowExisting: true,
		});
		expect(resolved).toBe("react-sample");
	});

	it("builds commit-scoped artifact file paths", () => {
		const artifactFiles = buildCommitArtifactFiles(
			"AA6D7C2271092417DE894C2D492EA01253B8117F",
		);
		expect(artifactFiles).toEqual({
			commitDir: "aa6d7c2271092417de894c2d492ea01253b8117f",
			diffFile: "aa6d7c2271092417de894c2d492ea01253b8117f/diff.diff",
			metadataFile: "aa6d7c2271092417de894c2d492ea01253b8117f/metadata.json",
		});
	});

	it("rejects invalid commit sha for artifact paths", () => {
		expect(() => buildCommitArtifactFiles("invalid-sha")).toThrow(
			"Invalid commit sha",
		);
	});
});
