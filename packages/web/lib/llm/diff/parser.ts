import type { FileDiff } from "./types";

const DIFF_HEADER_REGEX = /^diff --git a\/(.+?) b\/(.+?)$/;
const RENAME_FROM_REGEX = /^rename from (.+)$/;
const RENAME_TO_REGEX = /^rename to (.+)$/;
const NEW_FILE_REGEX = /^new file mode/;
const DELETED_FILE_REGEX = /^deleted file mode/;
const HUNK_HEADER_REGEX = /^@@/;
const ADDITION_LINE_REGEX = /^\+(?!\+\+)/;
const DELETION_LINE_REGEX = /^-(?!--)/;

export function isGitDiff(input: string): boolean {
	return input.split(/\r?\n/).some((line) => DIFF_HEADER_REGEX.test(line));
}

export function parseDiff(input: string): FileDiff[] {
	const files: FileDiff[] = [];
	const lines = input.split("\n");

	let currentFile: Partial<FileDiff> | null = null;
	let contentLines: string[] = [];
	let inHunk = false;

	const flushCurrentFile = () => {
		if (currentFile?.path) {
			files.push({
				path: currentFile.path,
				oldPath: currentFile.oldPath,
				type: currentFile.type ?? "modify",
				content: contentLines.join("\n"),
				additions: currentFile.additions ?? 0,
				deletions: currentFile.deletions ?? 0,
			});
		}
		currentFile = null;
		contentLines = [];
		inHunk = false;
	};

	for (const line of lines) {
		const headerMatch = line.match(DIFF_HEADER_REGEX);
		if (headerMatch) {
			flushCurrentFile();
			const [, oldPath, newPath] = headerMatch;
			currentFile = {
				path: newPath,
				oldPath: oldPath !== newPath ? oldPath : undefined,
				type: "modify",
				additions: 0,
				deletions: 0,
			};
			contentLines.push(line);
			continue;
		}

		if (!currentFile) continue;

		contentLines.push(line);

		if (NEW_FILE_REGEX.test(line)) {
			currentFile.type = "add";
		} else if (DELETED_FILE_REGEX.test(line)) {
			currentFile.type = "delete";
		} else if (RENAME_FROM_REGEX.test(line) || RENAME_TO_REGEX.test(line)) {
			currentFile.type = "rename";
		} else if (HUNK_HEADER_REGEX.test(line)) {
			inHunk = true;
		} else if (inHunk) {
			if (ADDITION_LINE_REGEX.test(line)) {
				currentFile.additions = (currentFile.additions ?? 0) + 1;
			} else if (DELETION_LINE_REGEX.test(line)) {
				currentFile.deletions = (currentFile.deletions ?? 0) + 1;
			}
		}
	}

	flushCurrentFile();
	return files;
}
