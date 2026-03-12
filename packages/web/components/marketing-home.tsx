import Link from "next/link";
import { Logo } from "./logo";
import { MarketingCommitMessageBenchmark } from "./marketing-commit-message-benchmark";
import { MarketingControlLoopSection } from "./marketing-control-loop-section";
import { MarketingFooter } from "./marketing-footer";
import { MarketingInstallCommand } from "./marketing-install-command";
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
							href="/docs"
							className="inline-flex items-center justify-center px-3 py-2.5 text-sm font-medium text-foreground no-underline hover:opacity-80 sm:px-4"
						>
							Docs
						</Link>
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
								href="/pricing"
								className="inline-flex items-center justify-center px-3 py-1.5 text-sm bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 transition-opacity"
							>
								Try Free
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
							You commit dozens of times a day.
							<br /> The message shouldn't slow you down.
						</h1>
						<div className="max-w-3xl">
							<div className="text-lg">
								<p>
									Your diff becomes multiple proposals — right in the terminal.
								</p>
								<p>Tweak until it reads like you wrote it.</p>
							</div>
							<div className="mt-6 flex flex-col items-start gap-3 sm:mt-7">
								<MarketingInstallCommand />
								<p className="pl-1 text-sm text-foreground-muted">
									Free — no account needed.{" "}
									<Link
										href="https://github.com/toyamarinyon/ultrahope"
										className="text-inherit hover:opacity-80 underline underline-offset-2 decoration-current transition-opacity"
										target="_blank"
										rel="noopener noreferrer"
									>
										Open source.
									</Link>
								</p>
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
						<div className="mt-6 sm:mt-8 flex flex-col items-center gap-2">
							<p className="text-center text-sm text-foreground-muted">
								Need unlimited requests?
							</p>
							<Link
								href="/pricing"
								className="inline-flex items-center justify-center px-4 py-2 text-sm border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover transition-colors"
							>
								See Pro plan →
							</Link>
						</div>
					</div>
				</div>
			</section>

			<section>
				<div className="flex flex-col items-center">
					<div className="w-full max-w-4xl text-center">
						<h2 className="text-2xl font-medium font-serif sm:text-3xl">
							Judge by the output, not the model name.
						</h2>
						<p className="mt-4 mb-10 text-base text-foreground-secondary sm:text-lg">
							A commit message is a single line. How much model do you need for
							one line?
						</p>
					</div>
					<div className="w-full max-w-6xl">
						<MarketingCommitMessageBenchmark />
					</div>
				</div>
			</section>

			<MarketingControlLoopSection />

			<MarketingFooter />
		</main>
	);
}
