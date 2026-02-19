export type TerminalStreamReplaySseEvent =
	| { type: "commit-message"; commitMessage: string }
	| {
			type: "usage";
			usage: {
				inputTokens: number;
				outputTokens: number;
				totalTokens?: number;
			};
	  }
	| {
			type: "provider-metadata";
			providerMetadata: unknown;
	  }
	| { type: "error"; message: string };

export interface TerminalStreamReplayGenerationEvent {
	atMs: number;
	model: string;
	attempt: number;
	event: TerminalStreamReplaySseEvent;
}

export interface TerminalStreamReplayGeneration {
	id: string;
	cliSessionId: string;
	models: string[];
	startedAt: string;
	endedAt?: string;
	events: TerminalStreamReplayGenerationEvent[];
}

export interface TerminalStreamReplayRun {
	id: string;
	command: string;
	args: string[];
	apiPath: string;
	startedAt: string;
	endedAt?: string;
	generations: TerminalStreamReplayGeneration[];
}

export interface TerminalStreamReplayCapture {
	version: 2;
	source: "ultrahope-commit-message-stream";
	capturedAt: string;
	runs: TerminalStreamReplayRun[];
}
