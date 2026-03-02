import { describe, expect, it, mock } from "bun:test";
import { generateCommitMessages } from "./vcs-message-generator";

type StreamCommitEvent = {
	type: "commit-message";
	commitMessage: string;
};

const state = {
	standardCalls: 0,
	refineCalls: 0,
	standardRequest: undefined as unknown,
	refineRequest: undefined as unknown,
	standardEvents: [] as StreamCommitEvent[],
	refineEvents: [] as StreamCommitEvent[],
};

const createStream = (events: StreamCommitEvent[]) =>
	(async function* () {
		for (const event of events) {
			yield event;
		}
	})();

class MockInsufficientBalanceError extends Error {}

class MockInvalidModelError extends Error {
	model = "unknown";
	allowedModels: string[] = [];
}

mock.module("./api-client", () => ({
	createApiClient: () => ({
		streamCommitMessage: (request: unknown) => {
			state.standardCalls += 1;
			state.standardRequest = request;
			return createStream(state.standardEvents);
		},
		streamCommitMessageRefine: (request: unknown) => {
			state.refineCalls += 1;
			state.refineRequest = request;
			return createStream(state.refineEvents);
		},
		recordGenerationScore: async () => {},
	}),
	InsufficientBalanceError: MockInsufficientBalanceError,
	InvalidModelError: MockInvalidModelError,
}));

mock.module("./auth", () => ({
	getToken: async () => "fake-token",
}));

async function collectCandidates(args: {
	diff: string;
	models: string[];
	guide?: string;
	refine?: { originalMessage: string; refineInstruction?: string };
	cliSessionId: string;
}): Promise<Array<{ content: string; model?: string; slotId: string }>> {
	const candidates: Array<{ content: string; model?: string; slotId: string }> =
		[];
	for await (const candidate of generateCommitMessages({
		diff: args.diff,
		models: args.models,
		guide: args.guide,
		refine: args.refine,
		cliSessionId: args.cliSessionId,
	})) {
		candidates.push({
			content: candidate.content,
			model: candidate.model,
			slotId: candidate.slotId,
		});
	}
	return candidates;
}

const resetState = () => {
	state.standardCalls = 0;
	state.refineCalls = 0;
	state.standardRequest = undefined;
	state.refineRequest = undefined;
	state.standardEvents = [];
	state.refineEvents = [];
};

describe("generateCommitMessages", () => {
	it("uses commit-message streaming endpoint without refine payload", async () => {
		resetState();
		state.standardEvents = [
			{ type: "commit-message", commitMessage: "feat: add feature" },
		];

		const candidates = await collectCandidates({
			diff: "diff body",
			models: ["mistral/ministral-3b"],
			cliSessionId: "session-id",
		});

		expect(state.standardCalls).toBe(1);
		expect(state.refineCalls).toBe(0);
		expect(state.standardRequest).toMatchObject({
			cliSessionId: "session-id",
			model: "mistral/ministral-3b",
			input: "diff body",
		});
		expect(candidates).toHaveLength(1);
		expect(candidates[0]).toMatchObject({
			content: "feat: add feature",
			model: "mistral/ministral-3b",
		});
	});

	it("uses refine streaming endpoint when refine payload is present", async () => {
		resetState();
		state.refineEvents = [
			{ type: "commit-message", commitMessage: "refined message" },
		];

		const candidates = await collectCandidates({
			diff: "diff body",
			models: ["mistral/ministral-3b"],
			cliSessionId: "session-id",
			refine: {
				originalMessage: "feat: add feature",
				refineInstruction: "Make shorter",
			},
		});

		expect(state.refineCalls).toBe(1);
		expect(state.standardCalls).toBe(0);
		expect(state.refineRequest).toMatchObject({
			cliSessionId: "session-id",
			model: "mistral/ministral-3b",
			originalMessage: "feat: add feature",
			refineInstruction: "Make shorter",
		});
		expect(candidates).toHaveLength(1);
		expect(candidates[0]).toMatchObject({
			content: "refined message",
			model: "mistral/ministral-3b",
		});
	});
});
