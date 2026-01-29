export type RuleRole = "primary" | "related" | "noise";

export type RuleBehavior = {
	role: RuleRole;
	omit?: boolean;
	priorityBoost?: number;
};

export type RuleMatch = {
	path?: string[];
	content?: string;
};

export type DiffRule = {
	id: string;
	label: string;
	match: RuleMatch;
	behavior: RuleBehavior;
};

export type PrimaryDetectionConfig = {
	excludeRoles: RuleRole[];
	metric: "changedLines" | "addedLines" | "fileCount";
};

export type DiffRulesConfig = {
	version: number;
	rules: DiffRule[];
	primaryDetection?: PrimaryDetectionConfig;
};

export type FileDiff = {
	path: string;
	oldPath?: string;
	type: "add" | "modify" | "delete" | "rename";
	content: string;
	additions: number;
	deletions: number;
};

export type ClassifiedFile = FileDiff & {
	ruleId: string | null;
	label: string;
	role: RuleRole;
	omit: boolean;
	isPrimary: boolean;
};

export type ClassificationResult = {
	primary: ClassifiedFile[];
	related: Map<string, ClassifiedFile[]>;
	noise: ClassifiedFile[];
};
