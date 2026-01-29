import type { TranslateRequest, TranslateResponse } from "./api-client";

const MOCK_COMMIT_MESSAGES = [
	"feat: implement new feature with improved performance",
	"fix: resolve edge case in data processing logic",
	"refactor: simplify code structure for better maintainability",
	"docs: update README with usage examples",
	"chore: update dependencies to latest versions",
	"test: add unit tests for core functionality",
	"style: format code according to style guide",
	"perf: optimize algorithm for faster execution",
];

const MOCK_PR_TITLES = [
	"Add new authentication flow",
	"Fix memory leak in worker process",
	"Refactor database connection handling",
	"Update documentation for API endpoints",
];

const MOCK_PR_BODIES = [
	`## Summary
This PR adds a new authentication flow that improves security and user experience.

## Changes
- Added OAuth2 support
- Implemented token refresh logic
- Updated session management

## Testing
- Added unit tests for auth module
- Tested manually with staging environment`,
];

function getMockOutput(target: TranslateRequest["target"]): string {
	let pool: string[];

	switch (target) {
		case "vcs-commit-message":
			pool = MOCK_COMMIT_MESSAGES;
			break;
		case "pr-title-body":
			pool = MOCK_PR_TITLES.map(
				(title, i) =>
					`${title}\n\n${MOCK_PR_BODIES[i % MOCK_PR_BODIES.length]}`,
			);
			break;
		case "pr-intent":
			pool = MOCK_PR_TITLES;
			break;
		default:
			pool = MOCK_COMMIT_MESSAGES;
	}

	const shuffled = [...pool].sort(() => Math.random() - 0.5);
	return shuffled[0];
}

export function createMockApiClient() {
	return {
		async translate(
			req: TranslateRequest,
			options?: { signal?: AbortSignal },
		): Promise<TranslateResponse> {
			if (options?.signal?.aborted) {
				const error = new Error("Aborted");
				error.name = "AbortError";
				throw error;
			}
			await new Promise<void>((resolve, reject) => {
				const timer = setTimeout(resolve, 100);
				const onAbort = () => {
					clearTimeout(timer);
					const error = new Error("Aborted");
					error.name = "AbortError";
					reject(error);
				};
				if (options?.signal) {
					options.signal.addEventListener("abort", onAbort, { once: true });
				}
			});
			const output = getMockOutput(req.target);
			return {
				output,
				content: output,
				vendor: "mock",
				model: "mock/mock-model",
				inputTokens: 100,
				outputTokens: 50,
				cost: 0.001,
			};
		},

		async requestDeviceCode() {
			return {
				device_code: "mock-device-code",
				user_code: "MOCK-1234",
				verification_uri: "https://ultrahope.dev/device",
				expires_in: 900,
				interval: 5,
			};
		},

		async pollDeviceToken(_deviceCode: string) {
			return {
				access_token: "mock-access-token",
				token_type: "Bearer",
			};
		},
	};
}
