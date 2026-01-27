import type { ClassificationResult, ClassifiedFile } from "./types";

function formatFileSummary(file: ClassifiedFile): string {
	const stats = `+${file.additions} -${file.deletions}`;
	return `${file.path} (${file.type}, ${stats})`;
}

function formatFileSection(files: ClassifiedFile[], omit: boolean): string {
	if (omit) {
		return files.map((f) => `  - ${formatFileSummary(f)}`).join("\n");
	}
	return files.map((f) => f.content).join("\n\n");
}

export function buildStructuredPrompt(result: ClassificationResult): string {
	const sections: string[] = [];

	if (result.primary.length > 0) {
		const paths = result.primary.map((f) => f.path).join(", ");
		sections.push(`## Primary Changes (${paths})`);
		sections.push(formatFileSection(result.primary, false));
	}

	for (const [label, files] of result.related) {
		const allOmit = files.every((f) => f.omit);
		sections.push(`\n## Related: ${label}`);
		sections.push(formatFileSection(files, allOmit));
	}

	if (result.noise.length > 0) {
		sections.push("\n## Auto-generated / Noise (summary only)");
		const summaries = result.noise
			.map((f) => `  - ${formatFileSummary(f)}`)
			.join("\n");
		sections.push(summaries);
	}

	return sections.join("\n");
}
