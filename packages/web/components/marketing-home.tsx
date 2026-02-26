import Link from "next/link";
import { Logo } from "./logo";
import { MarketingCommitMessageBenchmark } from "./marketing-commit-message-benchmark";
import { MarketingControlLoopSection } from "./marketing-control-loop-section";
import { MarketingInstallGuide } from "./marketing-install-guide";
import { TerminalTabsDemo } from "./terminal-tabs-demo";

function UltrahopeLogo() {
	return (
		<span className="inline-flex items-center gap-2">
			<span className="inline-flex size-8 shrink-0 items-center justify-center text-foreground sm:size-10">
				<Logo className="h-7 w-7 sm:h-9 sm:w-9" />
			</span>
			<span className="text-xl tracking-tighter leading-none sm:text-2xl font-logo">
				Ultrahope
			</span>
		</span>
	);
}

export function MarketingHome() {
	return (
		<main className="min-h-screen px-4 sm:px-8">
			<header>
				<div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-4">
					<Link href="/" className="text-foreground no-underline">
						<UltrahopeLogo />
					</Link>
					<div className="flex items-center gap-2 sm:gap-3">
						<Link
							href="/pricing"
							className="inline-flex items-center justify-center px-3 py-2.5 text-sm font-medium text-foreground no-underline hover:opacity-80 sm:px-4"
						>
							Pricing
						</Link>
						<Link
							href="/login"
							className="inline-flex items-center justify-center px-3 py-2.5 text-sm font-medium text-foreground no-underline hover:opacity-80 sm:px-4"
						>
							Sign in
						</Link>
						<span className="inline-flex p-1">
							<Link
								href="/signup"
								className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 transition-opacity"
							>
								Get Started
							</Link>
						</span>
					</div>
				</div>
			</header>

			{/* Hero - Vertical layout */}
			<section>
				<div className="py-16 lg:py-20 flex flex-col items-center gap-14 lg:gap-16">
					<div className="w-full max-w-4xl">
						<h1 className="mb-5 text-4xl font-medium font-serif">
							Fast AI commit messages
							<br /> you can compare
						</h1>
						<div className="max-w-3xl">
							<div className="text-lg">
								<p>Turn diffs into multiple proposals in your terminal.</p>
								<p>Reroll, edit, and confirm — without breaking your flow.</p>
							</div>
							<div className="mt-6 flex flex-col items-start gap-3 sm:mt-7">
								<Link
									href="/signup"
									className="inline-flex items-center justify-center px-3 py-1.5 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 transition-opacity"
								>
									Get Started for Free →
								</Link>
								<p className="pl-1 text-sm text-foreground-muted">
									Or,{" "}
									<Link
										href="https://github.com/toyamarinyon/ultrahope"
										className="text-inherit hover:opacity-80 underline underline-offset-2 decoration-current transition-opacity"
										target="_blank"
										rel="noopener noreferrer"
									>
										view on GitHub.
									</Link>
								</p>
								{/*<Link
												href="/pricing"
												className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface transition-colors"
											>
												Pricing
											</Link>*/}
							</div>
						</div>

						{/*<p className="mx-auto mb-10 max-w-[34ch] text-lg leading-relaxed text-foreground-secondary sm:text-xl lg:text-[1.55rem]">
							AI proposes. You compare. You decide.
						</p>*/}
					</div>

					<div className="w-full max-w-5xl">
						<div className="relative">
							<div className="absolute -inset-8 rounded-4xl bg-[radial-gradient(ellipse_at_top,#2b261f,transparent_65%)] opacity-70 blur-2xl" />
							<div className="relative">
								<TerminalTabsDemo />
							</div>
						</div>
						<MarketingInstallGuide />
					</div>
				</div>
			</section>

			<section>
				<div className="flex flex-col items-center">
					<div className="w-full max-w-3xl">
						<h1 className="mb-10 text-3xl font-medium font-serif">
							Coding agents are incredibly capable.
							<br />
							But not every task needs that level of intelligence.
						</h1>
					</div>
					<div className="w-full max-w-6xl">
						<MarketingCommitMessageBenchmark />
					</div>
				</div>
			</section>

			<MarketingControlLoopSection />

			<section className="relative py-20 sm:py-28">
				<div className="relative mx-auto w-full max-w-6xl px-2 text-center sm:px-6">
					<h2 className="text-3xl font-medium font-serif tracking-tight sm:text-4xl">
						Start fast. Escalate only when you need to.
					</h2>

					<div className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-border-subtle">
						<div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5">
							<code className="overflow-x-auto whitespace-nowrap text-base text-foreground-secondary sm:text-xl">
								$ npm i -g ultrahope
							</code>
							<span
								className="inline-flex size-8 shrink-0 items-center justify-center text-foreground-muted sm:size-9"
								aria-hidden="true"
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 16 16"
									fill="none"
									aria-hidden="true"
								>
									<rect
										x="5.5"
										y="5.5"
										width="7"
										height="7"
										rx="1.5"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
									<path
										d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
								</svg>
							</span>
						</div>
					</div>

					<div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
						<Link
							href="/signup"
							className="inline-flex min-w-56 items-center justify-center rounded-2xl bg-foreground px-8 py-3 text-lg font-medium text-canvas no-underline transition-opacity hover:opacity-90"
						>
							Get Started for Free →
						</Link>
						<Link
							href="/pricing"
							className="inline-flex min-w-56 items-center justify-center rounded-2xl border border-border-subtle px-8 py-3 text-lg font-medium text-foreground-secondary no-underline transition-colors hover:border-foreground-muted hover:text-foreground"
						>
							View Pricing
						</Link>
					</div>

					<p className="mt-8 text-base text-foreground-muted sm:text-lg">
						Or,{" "}
						<Link
							href="https://github.com/toyamarinyon/ultrahope"
							className="text-inherit underline underline-offset-4 decoration-current transition-opacity hover:opacity-80"
							target="_blank"
							rel="noopener noreferrer"
						>
							view on GitHub
						</Link>
					</p>
				</div>
			</section>

			{/* Install */}
			<section className="py-24 border-t border-border-subtle">
				<div className="mt-6 text-sm text-foreground-secondary">
					<Link href="/privacy" className="hover:opacity-80">
						Privacy Policy
					</Link>
					<span className="mx-2">·</span>
					<Link href="/terms" className="hover:opacity-80">
						Terms of Use
					</Link>
				</div>
			</section>
		</main>
	);
}
