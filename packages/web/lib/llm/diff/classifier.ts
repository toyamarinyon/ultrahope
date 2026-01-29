import { minimatch } from "minimatch";
import type {
	ClassificationResult,
	ClassifiedFile,
	DiffRule,
	DiffRulesConfig,
	FileDiff,
	RuleRole,
} from "./types";

function matchesRule(file: FileDiff, rule: DiffRule): boolean {
	if (rule.match.path) {
		const matched = rule.match.path.some((pattern) =>
			minimatch(file.path, pattern, { matchBase: true }),
		);
		if (matched) return true;
	}

	if (rule.match.content) {
		const regex = new RegExp(rule.match.content);
		if (regex.test(file.content)) return true;
	}

	return false;
}

function findMatchingRule(
	file: FileDiff,
	rules: DiffRule[],
): DiffRule | undefined {
	return rules.find((rule) => matchesRule(file, rule));
}

function calculateScore(
	file: FileDiff,
	metric: "changedLines" | "addedLines" | "fileCount",
	boost: number,
): number {
	let base: number;
	switch (metric) {
		case "changedLines":
			base = file.additions + file.deletions;
			break;
		case "addedLines":
			base = file.additions;
			break;
		case "fileCount":
			base = 1;
			break;
	}
	return base + boost;
}

export function classify(
	files: FileDiff[],
	config: DiffRulesConfig,
): ClassificationResult {
	const excludeRoles = config.primaryDetection?.excludeRoles ?? ["noise"];
	const metric = config.primaryDetection?.metric ?? "changedLines";

	const classified: ClassifiedFile[] = files.map((file) => {
		const rule = findMatchingRule(file, config.rules);
		const role: RuleRole = rule?.behavior.role ?? "primary";
		const omit = rule?.behavior.omit ?? false;
		const boost = rule?.behavior.priorityBoost ?? 0;

		return {
			...file,
			ruleId: rule?.id ?? null,
			label: rule?.label ?? "Source",
			role,
			omit,
			isPrimary: false,
			_score: excludeRoles.includes(role)
				? -1
				: calculateScore(file, metric, boost),
		} as ClassifiedFile & { _score: number };
	});

	const candidates = classified.filter(
		(f) => (f as ClassifiedFile & { _score: number })._score >= 0,
	);
	if (candidates.length > 0) {
		const maxScore = Math.max(
			...candidates.map(
				(f) => (f as ClassifiedFile & { _score: number })._score,
			),
		);
		for (const file of candidates) {
			if ((file as ClassifiedFile & { _score: number })._score === maxScore) {
				file.isPrimary = true;
				file.role = "primary";
			}
		}
	}

	const result: ClassificationResult = {
		primary: [],
		related: new Map(),
		noise: [],
	};

	for (const file of classified) {
		if (file.isPrimary) {
			result.primary.push(file);
		} else if (file.role === "noise") {
			result.noise.push(file);
		} else {
			const label = file.label;
			if (!result.related.has(label)) {
				result.related.set(label, []);
			}
			result.related.get(label)?.push(file);
		}
	}

	return result;
}
