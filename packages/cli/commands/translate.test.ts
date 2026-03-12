import { describe, expect, it } from "bun:test";
import type { CandidateWithModel, SelectorResult } from "../lib/selector";
import { decideVcsCommitMessageSelection } from "./translate";

describe("decideVcsCommitMessageSelection", () => {
	it("escalates with pro models and clears transient refinement state", () => {
		const decision = decideVcsCommitMessageSelection(
			{
				models: ["model-1"],
				guideHint: "first attempt hint",
				refineMessage: "existing suggestion",
				isEscalation: false,
			},
			{ action: "escalate" },
			["pro-1", "pro-2"],
		);

		expect(decision.kind).toBe("escalate");
		expect(decision.state).toEqual({
			models: ["pro-1", "pro-2"],
			guideHint: undefined,
			refineMessage: undefined,
			isEscalation: true,
		});
	});

	it("moves to refine with updated guide and refinement source", () => {
		const transition = decideVcsCommitMessageSelection(
			{
				models: ["model-1"],
				isEscalation: false,
			},
			{
				action: "refine",
				guide: "shorter version",
				selected: "Candidate from slot",
			} as SelectorResult,
			["pro-1", "pro-2"],
		);

		expect(transition.kind).toBe("refine");
		if (transition.kind !== "refine") {
			throw new Error("Expected refine transition");
		}
		expect(transition.state.guideHint).toBe("shorter version");
		expect(transition.state.refineMessage).toBe("Candidate from slot");
	});

	it("returns confirmation state with selected content and generation id", () => {
		const candidate: CandidateWithModel = {
			content: "final msg",
			slotId: "slot-0",
			generationId: "generation-123",
		};
		const transition = decideVcsCommitMessageSelection(
			{
				models: ["model-1"],
				isEscalation: false,
			},
			{
				action: "confirm",
				selected: "final msg",
				selectedCandidate: candidate,
			} as SelectorResult,
			["pro-1", "pro-2"],
		);

		expect(transition.kind).toBe("confirm");
		if (transition.kind !== "confirm") {
			throw new Error("Expected confirm transition");
		}
		expect(transition.selected).toBe("final msg");
		expect(transition.selectedCandidateGenerationId).toBe("generation-123");
	});
});
