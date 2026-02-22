import Link from "next/link";
import { Logo } from "./logo";
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
			<section className="min-h-[calc(100vh-5rem)] flex items-center max-w-7xl mx-auto">
				<div className="w-full py-16 lg:py-20 flex flex-col items-center gap-14 lg:gap-16">
					<div className="w-full max-w-4xl">
						<h1 className="mx-auto mb-5 text-4xl font-medium font-serif">
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

			{/* Features */}
			<section className="py-24 border-t border-border-subtle">
				<h2 className="text-3xl font-bold tracking-tight mb-12">Features</h2>
				<div className="grid md:grid-cols-3 gap-8">
					<div>
						<h3 className="text-lg font-semibold mb-2">Fast by design</h3>
						<p className="text-foreground-secondary">
							Parallel models. Low-latency generation.
						</p>
					</div>
					<div>
						<h3 className="text-lg font-semibold mb-2">
							Compare, don't prompt
						</h3>
						<p className="text-foreground-secondary">
							Multiple candidates, instant reroll, and edit before confirm.
						</p>
					</div>
					<div>
						<h3 className="text-lg font-semibold mb-2">Terminal-native</h3>
						<p className="text-foreground-secondary">
							Git. Jujutsu. Pipes. No context switch.
						</p>
					</div>
				</div>
			</section>

			{/* Why */}
			<section className="py-24 border-t border-border-subtle">
				<h2 className="text-3xl font-bold tracking-tight mb-6">
					Why Ultrahope
				</h2>
				<p className="text-lg text-foreground-secondary max-w-3xl leading-relaxed">
					I wanted fast AI commit messages I could compare in my terminal. So I
					built this. I use it every day.
				</p>
			</section>

			{/* Install */}
			<section className="py-24 border-t border-border-subtle">
				<h2 className="text-3xl font-bold tracking-tight mb-8">
					Get started in seconds
				</h2>
				<pre className="text-lg">
					<code>npm install -g @ultrahope/cli</code>
				</pre>
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
