import { execSync } from "node:child_process";

export interface DiffStats {
	files: number;
	insertions: number;
	deletions: number;
}

export function getGitStagedStats(): DiffStats {
	try {
		const output = execSync("git diff --cached --numstat", {
			encoding: "utf-8",
		});
		let files = 0;
		let insertions = 0;
		let deletions = 0;

		for (const line of output.trim().split("\n")) {
			if (!line) continue;
			const [added, deleted] = line.split("\t");
			files++;
			if (added !== "-") insertions += Number.parseInt(added, 10) || 0;
			if (deleted !== "-") deletions += Number.parseInt(deleted, 10) || 0;
		}

		return { files, insertions, deletions };
	} catch {
		return { files: 0, insertions: 0, deletions: 0 };
	}
}

export function getJjDiffStats(revision: string): DiffStats {
	try {
		const output = execSync(`jj diff -r ${revision} --stat`, {
			encoding: "utf-8",
		});
		const lines = output.trim().split("\n");
		const summaryLine = lines[lines.length - 1];
		const fileMatch = summaryLine.match(/(\d+)\s+file/);
		const insertMatch = summaryLine.match(/(\d+)\s+insertion/);
		const deleteMatch = summaryLine.match(/(\d+)\s+deletion/);

		return {
			files: fileMatch ? Number.parseInt(fileMatch[1], 10) : 0,
			insertions: insertMatch ? Number.parseInt(insertMatch[1], 10) : 0,
			deletions: deleteMatch ? Number.parseInt(deleteMatch[1], 10) : 0,
		};
	} catch {
		return { files: 0, insertions: 0, deletions: 0 };
	}
}

export function formatDiffStats(stats: DiffStats): string {
	const parts: string[] = [];
	parts.push(`${stats.files} file${stats.files !== 1 ? "s" : ""}`);
	parts.push(
		`${stats.insertions} insertion${stats.insertions !== 1 ? "s" : ""}`,
	);
	parts.push(`${stats.deletions} deletion${stats.deletions !== 1 ? "s" : ""}`);
	return parts.join(", ");
}
