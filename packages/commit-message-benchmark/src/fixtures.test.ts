import { describe, expect, it } from "bun:test";
import {
	getGitHubRepoFixtureFilePath,
	getGitHubRepoFixtureIndexPath,
	normalizeGitHubFixtureNamespace,
} from "./fixtures";

describe("fixtures helpers", () => {
	it("normalizes github fixture namespace to lowercase", () => {
		const normalized = normalizeGitHubFixtureNamespace({
			owner: "FaceBook",
			repo: "React",
		});
		expect(normalized).toEqual({
			owner: "facebook",
			repo: "react",
		});
	});

	it("rejects invalid github namespace segments", () => {
		expect(() =>
			normalizeGitHubFixtureNamespace({
				owner: "facebook",
				repo: "react/ui",
			}),
		).toThrow("GitHub repo");
	});

	it("builds repo-scoped fixture paths", () => {
		const indexPath = getGitHubRepoFixtureIndexPath({
			owner: "facebook",
			repo: "react",
		});
		const diffPath = getGitHubRepoFixtureFilePath("diffs/sample.diff", {
			owner: "facebook",
			repo: "react",
		});

		expect(indexPath.pathname).toContain(
			"/packages/commit-message-benchmark/fixtures/github/facebook/react/index.json",
		);
		expect(diffPath.pathname).toContain(
			"/packages/commit-message-benchmark/fixtures/github/facebook/react/diffs/sample.diff",
		);
	});
});
