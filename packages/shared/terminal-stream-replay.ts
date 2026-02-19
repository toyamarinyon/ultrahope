import type { CandidateWithModel } from "./terminal-selector-contract";

export interface TerminalStreamReplayEvent {
	atMs: number;
	candidate: CandidateWithModel;
}

export interface TerminalStreamReplayRun {
	id: string;
	command: string;
	revision: string;
	startedAt: string;
	endedAt?: string;
	events: TerminalStreamReplayEvent[];
}

export interface TerminalStreamReplayCapture {
	version: 1;
	source: "ultrahope-jj-describe";
	capturedAt: string;
	runs: TerminalStreamReplayRun[];
}
