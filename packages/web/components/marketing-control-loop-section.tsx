"use client";

import { type ReactNode, useState } from "react";
import { TerminalWindow } from "./terminal-window";

type ControlStepId = "compare" | "edit" | "refine" | "escalate";

type ControlStep = {
	id: ControlStepId;
	title: string;
	description: string;
};

const CONTROL_STEPS: ControlStep[] = [
	{
		id: "compare",
		title: "Compare candidates",
		description:
			"Multiple proposals generated in parallel.\nPick the one that fits.",
	},
	{
		id: "edit",
		title: "Edit before commit",
		description:
			"Tweak the wording directly. Keep your\nvoice in every commit.",
	},
	{
		id: "refine",
		title: "Refine with instruction",
		description:
			"Tell the model what to change. It\nregenerates based on your guidance.",
	},
	{
		id: "escalate",
		title: "Escalate",
		description: "Not satisfied? Shift+e to escalate to a more\ncapable model.",
	},
];

function TerminalBody({ children }: { children: ReactNode }) {
	return (
		<pre className="whitespace-pre-wrap wrap-break-words text-sm text-foreground-secondary">
			{children}
		</pre>
	);
}

const TERMINAL_CONTENT: Record<ControlStepId, ReactNode> = {
	compare: (
		<TerminalBody>
			<span className="text-foreground">$ git ultrahope commit{"\n"}</span>
			<span className="text-emerald-400">✔ Found staged changes{"\n"}</span>3
			commit messages generated (total: $0.000342){"\n"}
			Select a candidate (up/down navigate, enter confirm){"\n"}
			{"\n"}○ feat(api): add stream event timestamps and metadata support{"\n"}
			ministral-3b $0.0001049 871ms{"\n"}
			{"\n"}○ refactor(api): restructure stream event metadata handling{"\n"}
			ministral-3b $0.0001049 871ms{"\n"}
			{"\n"}
			<span className="text-foreground">
				● fix(api): add missing timestamp to stream events
			</span>
			{"\n"}ministral-3b $0.0001049 871ms{"\n"}
			{"\n"}enter confirm · e edit · r refine · E escalate
		</TerminalBody>
	),
	edit: (
		<TerminalBody>
			Selected: fix(api): add missing timestamp to stream events{"\n"}
			{"\n"}e -&gt; editing...{"\n"}
			{"\n"}
			<span className="line-through">
				fix(api): add missing timestamp to stream events
			</span>
			{"\n"}
			<span className="text-foreground">
				● fix(api): add missing <span className="text-amber-200">atMs</span>{" "}
				timestamp to stream events
			</span>
			{"\n"}
			{"\n"}enter confirm · r refine · E escalate
		</TerminalBody>
	),
	refine: (
		<TerminalBody>
			Selected: fix(api): add missing timestamp to stream events{"\n"}
			{"\n"}r -&gt; refine{"\n"}
			<span className="text-amber-200">
				&gt; be more specific about what timestamp field was added
			</span>
			{"\n"}
			{"\n"}Refining with ministral-3b...{"\n"}
			{"\n"}○ fix(api): add atMs field to stream event payload for timestamp
			tracking{"\n"}
			ministral-3b $0.0001 893ms{"\n"}
			{"\n"}
			<span className="text-foreground">
				● fix(api): add missing atMs timestamp field to commit message stream
				events
			</span>
			{"\n"}ministral-3b $0.0001 893ms{"\n"}
			{"\n"}enter confirm · e edit · E escalate
		</TerminalBody>
	),
	escalate: (
		<TerminalBody>
			E -&gt; escalating...{"\n"}
			{"\n"}2 commit messages generated ($0.0099, 1.6s){"\n"}
			Select a candidate (up/down navigate, enter confirm){"\n"}
			{"\n"}○ fix(api): add atMs timestamp to commit message stream events{"\n"}
			claude-sonnet-4.6 $0.00990 1.6s{"\n"}
			{"\n"}
			<span className="text-foreground">
				● feat(api): add event timestamp and metadata support to streams
			</span>
			{"\n"}claude-sonnet-4.6 $0.00990 1.6s{"\n"}
			{"\n"}
			<span className="text-emerald-400">
				✔ Committed: feat(api): add event timestamp and metadata support to
				streams
			</span>
		</TerminalBody>
	),
};

export function MarketingControlLoopSection() {
	const [activeStepId, setActiveStepId] = useState<ControlStepId>("compare");
	const activeTabId = `control-loop-tab-${activeStepId}`;

	return (
		<section>
			<div className="py-16 lg:py-20 flex flex-col items-center gap-12 lg:gap-14">
				<div className="w-full max-w-4xl text-center">
					<h2 className="text-2xl font-medium font-serif sm:text-3xl">
						What if the result isn&apos;t quite right?
					</h2>
					<p className="mt-4 text-base text-foreground-secondary sm:text-lg">
						You stay in control. The model just gets you started.
					</p>
				</div>

				<div className="w-full max-w-6xl">
					<div className="grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-10 lg:items-center">
						<div
							role="tablist"
							aria-orientation="vertical"
							className="space-y-8"
						>
							{CONTROL_STEPS.map((step) => {
								const isActive = step.id === activeStepId;
								const tabId = `control-loop-tab-${step.id}`;
								return (
									<button
										key={step.id}
										type="button"
										role="tab"
										id={tabId}
										aria-selected={isActive}
										aria-controls="control-loop-panel"
										tabIndex={isActive ? 0 : -1}
										onClick={() => setActiveStepId(step.id)}
										className={`w-full border-l-2 pl-5 text-left transition-colors ${
											isActive
												? "border-l-foreground-secondary text-foreground"
												: "border-l-transparent text-foreground-muted hover:text-foreground-secondary"
										}`}
									>
										<p className="text-lg leading-tight font-medium">
											{step.title}
										</p>
										<p className="mt-1.5 text-sm leading-[1.45] whitespace-pre-line text-foreground-muted sm:text-base">
											{step.description}
										</p>
									</button>
								);
							})}
						</div>

						<TerminalWindow title="ultrahope" className="font-mono">
							<div
								id="control-loop-panel"
								role="tabpanel"
								aria-labelledby={activeTabId}
								className="h-100 overflow-auto px-5 py-5 sm:px-6 sm:py-6"
							>
								{TERMINAL_CONTENT[activeStepId]}
							</div>
						</TerminalWindow>
					</div>
				</div>

				<p className="text-center font-mono text-base text-foreground-secondary sm:text-lg">
					The model drafts. You have the final word.
				</p>
			</div>
		</section>
	);
}
