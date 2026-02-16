import Link from "next/link";
import { Logo } from "./logo";
import { TerminalTabsDemo } from "./terminal-tabs-demo";

function UltrahopeLogo() {
	return (
		<span className="inline-flex items-center gap-2">
			<span className="inline-flex size-10 shrink-0 items-center justify-center text-foreground">
				<Logo className="w-9 h-9" />
			</span>
			<span className="text-2xl tracking-tighter leading-none">Ultrahope</span>
		</span>
	);
}

export function MarketingHome() {
	return (
		<main className="min-h-screen px-8">
			<header>
				<div className="max-w-7xl mx-auto h-20 flex items-center justify-between gap-4">
					<Link href="/" className="text-foreground no-underline">
						<UltrahopeLogo />
					</Link>
					<div className="flex items-center gap-3">
						<Link
							href="https://github.com/toyamarinyon/ultrahope"
							className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface transition-colors"
						>
							<svg
								className="w-5 h-5"
								fill="currentColor"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path
									fillRule="evenodd"
									d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
									clipRule="evenodd"
								/>
							</svg>
							GitHub
						</Link>
						<Link
							href="/signup"
							className="inline-flex items-center justify-center px-4 py-2.5 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 transition-opacity"
						>
							Get Started
						</Link>
					</div>
				</div>
			</header>

			{/* Hero - Two column layout */}
			<section className="min-h-[calc(100vh-5rem)] flex items-center max-w-7xl mx-auto">
				<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 w-full py-16">
					{/* Left: Branding */}
					<div className="flex flex-col justify-center">
						<h1 className="text-3xl lg:text-5xl tracking-tighter mb-6 max-w-2xl">
							The decision pipe for AI-native software development.
						</h1>
						<p className="text-lg lg:text-xl text-foreground-secondary leading-relaxed mb-10 max-w-xl">
							One command in. Proposals out. Human decision stays in the loop.
						</p>

						<div className="flex flex-wrap gap-4">
							<Link
								href="/signup"
								className="inline-flex items-center justify-center px-6 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90 transition-opacity"
							>
								Get Started
							</Link>
							<Link
								href="/pricing"
								className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface transition-colors"
							>
								Pricing
							</Link>
						</div>
					</div>

					{/* Right: Interactive Terminal Demo */}
					<div className="flex flex-col justify-center">
						<div className="relative">
							<div className="absolute -inset-6 rounded-[28px] bg-[radial-gradient(ellipse_at_top,#2b261f,transparent_60%)] opacity-70 blur-2xl" />
							<div className="relative">
								<TerminalTabsDemo />
							</div>
						</div>
						<p className="mt-4 text-sm text-foreground-muted text-center">
							Inference runs in the background. Decisions stay in your flow.
						</p>
					</div>
				</div>
			</section>

			{/* Features */}
			<section className="py-24 border-t border-border-subtle">
				<h2 className="text-3xl font-bold tracking-tight mb-12">Features</h2>
				<div className="grid md:grid-cols-3 gap-8">
					<div>
						<h3 className="text-lg font-semibold mb-2">Adoptable proposals</h3>
						<p className="text-foreground-secondary">
							Turn diffs into commit messages, PR title/body drafts, and intent
							summaries.
						</p>
					</div>
					<div>
						<h3 className="text-lg font-semibold mb-2">Human decision, fast</h3>
						<p className="text-foreground-secondary">
							Compare candidates, reroll, edit, and confirm without leaving your
							terminal.
						</p>
					</div>
					<div>
						<h3 className="text-lg font-semibold mb-2">
							UNIX + multi-agent ready
						</h3>
						<p className="text-foreground-secondary">
							Works with pipes, Git, and Jujutsu so you can keep your existing
							workflow.
						</p>
					</div>
				</div>
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
