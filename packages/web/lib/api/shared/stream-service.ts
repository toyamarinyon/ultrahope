import type { ProviderMetadata } from "ai";

export type CommitMessageStreamEvent =
	| ({ atMs?: number } & { type: "commit-message"; commitMessage: string })
	| {
			atMs?: number;
			type: "usage";
			usage: { inputTokens: number; outputTokens: number };
	  }
	| {
			atMs?: number;
			type: "provider-metadata";
			providerMetadata: ProviderMetadata | undefined;
	  }
	| ({ atMs?: number } & { type: "error"; message: string });

const encoder = new TextEncoder();

export function formatSseEvent(event: CommitMessageStreamEvent): Uint8Array {
	return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function normalizeCommitMessage(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export function trimCommitMessageWrappers(text: string): string {
	const trimmed = text.trim();
	if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
		const fencedWithInfo = trimmed.match(/^```(?:[^\n\r]*)\n([\s\S]*?)\n```$/);
		if (fencedWithInfo?.[1] !== undefined) {
			return fencedWithInfo[1];
		}
		if (trimmed.length > 6) {
			return trimmed.slice(3, -3);
		}
	}

	if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length > 2) {
		return trimmed.slice(1, -1);
	}

	return trimmed;
}

type CodeFenceCommitMessageSanitizer = {
	push(chunk: string): string;
	finish(): string;
};

export function createCommitMessageSanitizer(): CodeFenceCommitMessageSanitizer {
	let inCodeFence = false;
	let pendingLine = "";

	const stripSingleLineCodeFence = (line: string): string | null => {
		if (!line.startsWith("```")) return null;

		const closingIndex = line.lastIndexOf("```");
		if (closingIndex <= 2) return null;

		return line.slice(3, closingIndex);
	};

	const processCompleteLine = (line: string): string | null => {
		const inlineCommitMessage = stripSingleLineCodeFence(line);
		if (inlineCommitMessage !== null) return inlineCommitMessage;

		if (line.startsWith("```")) {
			inCodeFence = !inCodeFence;
			return null;
		}

		if (inCodeFence) return null;

		return line;
	};

	const processPendingLineForStreaming = (): string | undefined => {
		if (!pendingLine) return "";

		const inlineCommitMessage = stripSingleLineCodeFence(pendingLine);
		if (inlineCommitMessage !== null) {
			pendingLine = "";
			return inlineCommitMessage;
		}

		if (inCodeFence) return "";

		if (pendingLine.startsWith("```")) return "";

		const output = pendingLine;
		pendingLine = "";
		return output;
	};

	return {
		push(chunk: string): string {
			const text = pendingLine + chunk;
			const lines = text.split("\n");
			pendingLine = lines.pop() ?? "";

			let sanitized = "";
			for (const line of lines) {
				const cleanedLine = processCompleteLine(line);
				if (cleanedLine === null) continue;
				sanitized += `${cleanedLine}\n`;
			}

			const pendingOutput = processPendingLineForStreaming();
			if (pendingOutput === undefined) {
				return sanitized;
			}

			pendingLine = "";
			return sanitized + pendingOutput;
		},

		finish(): string {
			if (pendingLine) {
				const inlineCommitMessage = stripSingleLineCodeFence(pendingLine);
				if (inlineCommitMessage !== null) {
					pendingLine = "";
					return inlineCommitMessage;
				}

				if (pendingLine.startsWith("```")) {
					pendingLine = "";
					return "";
				}

				if (!inCodeFence) {
					const output = pendingLine;
					pendingLine = "";
					return output;
				}
			}

			return "";
		},
	};
}
