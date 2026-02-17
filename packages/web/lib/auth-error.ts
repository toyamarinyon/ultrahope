export type AuthErrorFlow =
	| "login"
	| "signup"
	| "forgot-password"
	| "device-signin"
	| "device-signup"
	| "reset-password";

type AuthErrorMappingResult = {
	userMessage: string;
	internal?: unknown;
};

const GENERIC_AUTH_ERROR = "Authentication failed. Please try again later.";
const URL_FAILURE_ERROR =
	"Failed to process the request. Please try again later.";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readStringField(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	return typeof value === "string" ? value : "";
}

function parseJsonIfPossible(input: string): unknown | null {
	try {
		return JSON.parse(input);
	} catch {
		return null;
	}
}

function collectMessageCandidates(input: unknown): string[] {
	const candidates: string[] = [];
	if (typeof input === "string") {
		candidates.push(input);
		const parsed = parseJsonIfPossible(input);
		if (isRecord(parsed)) {
			candidates.push(readStringField(parsed, "message"));
			candidates.push(readStringField(parsed, "error"));
			candidates.push(readStringField(parsed, "error_description"));
			candidates.push(readStringField(parsed, "code"));
		}
		return candidates.filter(Boolean);
	}

	if (!isRecord(input)) {
		return candidates;
	}

	candidates.push(readStringField(input, "message"));
	candidates.push(readStringField(input, "error"));
	candidates.push(readStringField(input, "error_description"));
	candidates.push(readStringField(input, "code"));
	candidates.push(readStringField(input, "statusText"));
	candidates.push(readStringField(input, "name"));

	if (isRecord(input.body)) {
		candidates.push(readStringField(input.body, "message"));
		candidates.push(readStringField(input.body, "error"));
		candidates.push(readStringField(input.body, "error_description"));
		candidates.push(readStringField(input.body, "code"));
	}

	const message = readStringField(input, "message");
	if (message) {
		const parsed = parseJsonIfPossible(message);
		if (isRecord(parsed)) {
			candidates.push(readStringField(parsed, "message"));
			candidates.push(readStringField(parsed, "error"));
			candidates.push(readStringField(parsed, "error_description"));
			candidates.push(readStringField(parsed, "code"));
		}
	}

	return candidates.filter(Boolean);
}

function containsAny(text: string, needles: string[]): boolean {
	return needles.some((needle) => text.includes(needle));
}

function mapByKnownPatterns(
	combined: string,
	flow: AuthErrorFlow,
): string | null {
	if (
		containsAny(combined, [
			"URL_INVALID",
			"INVALID REDIRECTURL",
			"INVALID CALLBACKURL",
			"INVALID URL",
			"MISSING_OR_NULL_ORIGIN",
		])
	) {
		return URL_FAILURE_ERROR;
	}

	if (combined.includes("INVALID_EMAIL_OR_PASSWORD")) {
		return "Invalid email or password.";
	}
	if (combined.includes("INVALID EMAIL OR PASSWORD")) {
		return "Invalid email or password.";
	}

	if (
		containsAny(combined, ["INVALID_EMAIL", "EMAIL_INVALID", "INVALID EMAIL"])
	) {
		return "Please enter a valid email address.";
	}

	if (
		containsAny(combined, [
			"USER_ALREADY_EXISTS",
			"USE_ANOTHER_EMAIL",
			"ALREADY EXISTS",
		]) &&
		(flow === "signup" || flow === "device-signup")
	) {
		return "This email address is already registered.";
	}

	if (containsAny(combined, ["PASSWORD_TOO_SHORT", "PASSWORD TOO SHORT"])) {
		return "Password must be at least 8 characters.";
	}

	if (containsAny(combined, ["INVALID_TOKEN", "INVALID TOKEN"])) {
		return "The link is invalid or has expired.";
	}

	return null;
}

export function mapAuthClientError(
	input: unknown,
	flow: AuthErrorFlow,
): AuthErrorMappingResult {
	const candidates = collectMessageCandidates(input);
	const combined = candidates.join(" | ").toUpperCase();
	const mapped = mapByKnownPatterns(combined, flow);
	if (mapped) {
		return { userMessage: mapped, internal: input };
	}
	return { userMessage: GENERIC_AUTH_ERROR, internal: input };
}

export function shouldTreatForgotPasswordRequestAsSuccess(
	result: unknown,
): boolean {
	if (!isRecord(result)) {
		return true;
	}
	if (!("error" in result)) {
		return true;
	}
	return !result.error;
}

export function isLikelyInvalidEmailDomain(email: string): boolean {
	const value = email.trim().toLowerCase();
	const parts = value.split("@");
	if (parts.length !== 2) {
		return true;
	}

	const [localPart, domain] = parts;
	if (!localPart || !domain) {
		return true;
	}

	if (domain === "localhost" || domain.endsWith(".localhost")) {
		return true;
	}

	if (
		domain.startsWith(".") ||
		domain.endsWith(".") ||
		domain.includes("..") ||
		!domain.includes(".")
	) {
		return true;
	}

	if (!/^[a-z0-9.-]+$/.test(domain)) {
		return true;
	}

	const labels = domain.split(".");
	if (labels.some((label) => !label)) {
		return true;
	}

	for (const label of labels) {
		if (!/^[a-z0-9-]+$/.test(label)) {
			return true;
		}
		if (label.startsWith("-") || label.endsWith("-")) {
			return true;
		}
	}

	const tld = labels[labels.length - 1];
	if (!tld || tld.length < 2) {
		return true;
	}

	return false;
}
