export interface paths {
	"/api/v1/command_execution": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		get?: never;
		put?: never;
		/** Create a command execution record */
		post: operations["postApiV1Command_execution"];
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	"/api/v1/commit-message": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		get?: never;
		put?: never;
		/** Generate a commit message from a diff */
		post: operations["postApiV1Commit-message"];
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	"/api/v1/commit-message/stream": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		get?: never;
		put?: never;
		/** Stream a commit message from a diff */
		post: operations["postApiV1Commit-messageStream"];
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	"/api/v1/commit-message/refine": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		get?: never;
		put?: never;
		/** Refine a commit message from a selected message */
		post: operations["postApiV1Commit-messageRefine"];
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	"/api/v1/commit-message/refine/stream": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		get?: never;
		put?: never;
		/** Stream a refined commit message from a selected message */
		post: operations["postApiV1Commit-messageRefineStream"];
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	"/api/v1/pr-title-body": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		get?: never;
		put?: never;
		/** Generate a PR title and body from git log */
		post: operations["postApiV1Pr-title-body"];
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	"/api/v1/pr-intent": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		get?: never;
		put?: never;
		/** Generate a PR intent summary from a diff */
		post: operations["postApiV1Pr-intent"];
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	"/api/v1/generation_score": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		get?: never;
		put?: never;
		/** Record feedback for a generation */
		post: operations["postApiV1Generation_score"];
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
	"/api/health": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		/** Health check */
		get: operations["getApiHealth"];
		put?: never;
		post?: never;
		delete?: never;
		options?: never;
		head?: never;
		patch?: never;
		trace?: never;
	};
}
export type webhooks = Record<string, never>;
export interface components {
	schemas: never;
	responses: never;
	parameters: never;
	requestBodies: never;
	headers: never;
	pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
	postApiV1Command_execution: {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody: {
			content: {
				"application/json": {
					commandExecutionId: string;
					cliSessionId: string;
					command: string;
					args: string[];
					api: string;
					requestPayload: {
						input: string;
						/** @enum {string} */
						target: "vcs-commit-message" | "pr-title-body" | "pr-intent";
						model?: string;
						models?: string[];
						guide?: string;
					};
				};
				"application/x-www-form-urlencoded": {
					commandExecutionId: string;
					cliSessionId: string;
					command: string;
					args: string[];
					api: string;
					requestPayload: {
						input: string;
						/** @enum {string} */
						target: "vcs-commit-message" | "pr-title-body" | "pr-intent";
						model?: string;
						models?: string[];
						guide?: string;
					};
				};
				"multipart/form-data": {
					commandExecutionId: string;
					cliSessionId: string;
					command: string;
					args: string[];
					api: string;
					requestPayload: {
						input: string;
						/** @enum {string} */
						target: "vcs-commit-message" | "pr-title-body" | "pr-intent";
						model?: string;
						models?: string[];
						guide?: string;
					};
				};
			};
		};
		responses: {
			/** @description Response for status 200 */
			200: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						commandExecutionId: string;
					};
				};
			};
			/** @description Response for status 400 */
			400: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						/** @constant */
						error: "input_too_long";
						message: string;
						count: number;
						limit: number;
						/** @constant */
						plan: "free";
					};
				};
			};
			/** @description Response for status 401 */
			401: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						error: string;
					};
				};
			};
			/** @description Response for status 402 */
			402: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "daily_limit_exceeded";
								message: string;
								count: number;
								limit: number;
								resetsAt: string;
								/** @constant */
								plan: "free";
								actions: {
									upgrade: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "insufficient_balance";
								message: string;
								balance: number;
								plan: "free" | "pro";
								actions: {
									buyCredits: string;
								};
								hint: string;
						  };
				};
			};
		};
	};
	"postApiV1Commit-message": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody: {
			content: {
				"application/json": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
				"application/x-www-form-urlencoded": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
				"multipart/form-data": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
			};
		};
		responses: {
			/** @description Response for status 200 */
			200: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						output: string;
						content: string;
						vendor: string;
						model: string;
						inputTokens: number;
						outputTokens: number;
						cachedInputTokens?: number;
						cost?: number;
						generationId: string;
						quota?: {
							remaining: number;
							limit: number;
							resetsAt: string;
						};
					};
				};
			};
			/** @description Response for status 400 */
			400: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "invalid_model";
								message: string;
								allowedModels: string[];
						  }
						| {
								/** @constant */
								error: "input_too_long";
								message: string;
								count: number;
								limit: number;
								/** @constant */
								plan: "free";
						  };
				};
			};
			/** @description Response for status 401 */
			401: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						error: string;
					};
				};
			};
			/** @description Response for status 402 */
			402: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "daily_limit_exceeded";
								message: string;
								count: number;
								limit: number;
								resetsAt: string;
								/** @constant */
								plan: "free";
								actions: {
									upgrade: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "insufficient_balance";
								message: string;
								balance: number;
								plan: "free" | "pro";
								actions: {
									buyCredits: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "billing_unavailable";
								message: string;
						  };
				};
			};
		};
	};
	"postApiV1Commit-messageStream": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody: {
			content: {
				"application/json": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
				"application/x-www-form-urlencoded": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
				"multipart/form-data": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
			};
		};
		responses: never;
	};
	"postApiV1Commit-messageRefine": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody: {
			content: {
				"application/json": {
					cliSessionId: string;
					model: string;
					originalMessage: string;
					refineInstruction?: string;
				};
				"application/x-www-form-urlencoded": {
					cliSessionId: string;
					model: string;
					originalMessage: string;
					refineInstruction?: string;
				};
				"multipart/form-data": {
					cliSessionId: string;
					model: string;
					originalMessage: string;
					refineInstruction?: string;
				};
			};
		};
		responses: {
			/** @description Response for status 200 */
			200: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						output: string;
						content: string;
						vendor: string;
						model: string;
						inputTokens: number;
						outputTokens: number;
						cachedInputTokens?: number;
						cost?: number;
						generationId: string;
						quota?: {
							remaining: number;
							limit: number;
							resetsAt: string;
						};
					};
				};
			};
			/** @description Response for status 400 */
			400: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "invalid_model";
								message: string;
								allowedModels: string[];
						  }
						| {
								/** @constant */
								error: "input_too_long";
								message: string;
								count: number;
								limit: number;
								/** @constant */
								plan: "free";
						  };
				};
			};
			/** @description Response for status 401 */
			401: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						error: string;
					};
				};
			};
			/** @description Response for status 402 */
			402: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "daily_limit_exceeded";
								message: string;
								count: number;
								limit: number;
								resetsAt: string;
								/** @constant */
								plan: "free";
								actions: {
									upgrade: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "insufficient_balance";
								message: string;
								balance: number;
								plan: "free" | "pro";
								actions: {
									buyCredits: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "billing_unavailable";
								message: string;
						  };
				};
			};
		};
	};
	"postApiV1Commit-messageRefineStream": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody: {
			content: {
				"application/json": {
					cliSessionId: string;
					model: string;
					originalMessage: string;
					refineInstruction?: string;
				};
				"application/x-www-form-urlencoded": {
					cliSessionId: string;
					model: string;
					originalMessage: string;
					refineInstruction?: string;
				};
				"multipart/form-data": {
					cliSessionId: string;
					model: string;
					originalMessage: string;
					refineInstruction?: string;
				};
			};
		};
		responses: never;
	};
	"postApiV1Pr-title-body": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody: {
			content: {
				"application/json": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
				"application/x-www-form-urlencoded": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
				"multipart/form-data": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
			};
		};
		responses: {
			/** @description Response for status 200 */
			200: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						output: string;
						content: string;
						vendor: string;
						model: string;
						inputTokens: number;
						outputTokens: number;
						cachedInputTokens?: number;
						cost?: number;
						generationId: string;
						quota?: {
							remaining: number;
							limit: number;
							resetsAt: string;
						};
					};
				};
			};
			/** @description Response for status 400 */
			400: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "invalid_model";
								message: string;
								allowedModels: string[];
						  }
						| {
								/** @constant */
								error: "input_too_long";
								message: string;
								count: number;
								limit: number;
								/** @constant */
								plan: "free";
						  };
				};
			};
			/** @description Response for status 401 */
			401: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						error: string;
					};
				};
			};
			/** @description Response for status 402 */
			402: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "daily_limit_exceeded";
								message: string;
								count: number;
								limit: number;
								resetsAt: string;
								/** @constant */
								plan: "free";
								actions: {
									upgrade: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "insufficient_balance";
								message: string;
								balance: number;
								plan: "free" | "pro";
								actions: {
									buyCredits: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "billing_unavailable";
								message: string;
						  };
				};
			};
		};
	};
	"postApiV1Pr-intent": {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody: {
			content: {
				"application/json": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
				"application/x-www-form-urlencoded": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
				"multipart/form-data": {
					cliSessionId: string;
					input: string;
					model: string;
					guide?: string;
				};
			};
		};
		responses: {
			/** @description Response for status 200 */
			200: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						output: string;
						content: string;
						vendor: string;
						model: string;
						inputTokens: number;
						outputTokens: number;
						cachedInputTokens?: number;
						cost?: number;
						generationId: string;
						quota?: {
							remaining: number;
							limit: number;
							resetsAt: string;
						};
					};
				};
			};
			/** @description Response for status 400 */
			400: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "invalid_model";
								message: string;
								allowedModels: string[];
						  }
						| {
								/** @constant */
								error: "input_too_long";
								message: string;
								count: number;
								limit: number;
								/** @constant */
								plan: "free";
						  };
				};
			};
			/** @description Response for status 401 */
			401: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						error: string;
					};
				};
			};
			/** @description Response for status 402 */
			402: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json":
						| {
								/** @constant */
								error: "daily_limit_exceeded";
								message: string;
								count: number;
								limit: number;
								resetsAt: string;
								/** @constant */
								plan: "free";
								actions: {
									upgrade: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "insufficient_balance";
								message: string;
								balance: number;
								plan: "free" | "pro";
								actions: {
									buyCredits: string;
								};
								hint: string;
						  }
						| {
								/** @constant */
								error: "billing_unavailable";
								message: string;
						  };
				};
			};
		};
	};
	postApiV1Generation_score: {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody: {
			content: {
				"application/json": {
					generationId: string;
					value: number;
				};
				"application/x-www-form-urlencoded": {
					generationId: string;
					value: number;
				};
				"multipart/form-data": {
					generationId: string;
					value: number;
				};
			};
		};
		responses: {
			/** @description Response for status 200 */
			200: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						ok: boolean;
					};
				};
			};
			/** @description Response for status 401 */
			401: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						error: string;
					};
				};
			};
			/** @description Response for status 404 */
			404: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						error: string;
					};
				};
			};
		};
	};
	getApiHealth: {
		parameters: {
			query?: never;
			header?: never;
			path?: never;
			cookie?: never;
		};
		requestBody?: never;
		responses: {
			/** @description Response for status 200 */
			200: {
				headers: {
					[name: string]: unknown;
				};
				content: {
					"application/json": {
						status: string;
					};
				};
			};
		};
	};
}
