import Link from "next/link";

export function MarketingHome() {
	return (
		<main className="min-h-screen px-8">
			{/* Hero */}
			<section className="min-h-[85vh] flex flex-col justify-center max-w-5xl mx-auto">
				<div className="max-w-3xl">
					<h1 className="text-6xl font-black tracking-tighter mb-6">
						Ultrahope
					</h1>
					<p className="text-xl text-foreground-secondary leading-relaxed mb-12 max-w-xl">
						LLM-powered development workflow assistant. A simple UNIX tool that
						works with pipes.
					</p>

					<div className="flex flex-wrap gap-4">
						<Link
							href="/login"
							className="inline-flex items-center justify-center px-6 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90"
						>
							Get Started
						</Link>
						<Link
							href="/pricing"
							className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface"
						>
							Pricing
						</Link>
					</div>
				</div>

				<div className="mt-14">
					<div className="relative">
						<div className="absolute -inset-6 rounded-[28px] bg-[radial-gradient(ellipse_at_top,_#2b261f,_transparent_60%)] opacity-70 blur-2xl" />
						<div className="relative rounded-2xl border border-border-subtle bg-canvas-dark overflow-hidden">
							<div className="flex items-center gap-2 px-4 py-3 border-b border-border-subtle bg-surface">
								<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/60" />
								<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/40" />
								<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
								<span className="ml-3 text-xs text-foreground-secondary">
									git ultrahope commit
								</span>
							</div>
							<div className="px-6 py-6 font-mono text-sm leading-relaxed text-foreground-secondary">
								<pre className="bg-transparent border-0 p-0">
									<code>
										<span className="text-foreground">$ </span>
										git ultrahope commit{"\n"}
										Analyzing staged changes...{"\n"}
										Found 3 files, 128 insertions, 42 deletions{"\n"}
										{"\n"}
										<span className="text-foreground">
											Suggested commit message
										</span>
										{"\n"}
										feat(cli): generate commit message from staged diff{"\n"}
										{"\n"}
										Press Enter to accept • Ctrl+C to cancel
									</code>
								</pre>
							</div>
						</div>
					</div>
					<p className="mt-4 text-sm text-foreground-muted">
						"git ultrahope commit" transforms your staged diff into a clean,
						human-readable commit message.
					</p>
				</div>
			</section>

			{/* Features */}
			<section className="py-24 border-t border-border-subtle">
				<h2 className="text-3xl font-bold tracking-tight mb-12">Features</h2>
				<div className="grid md:grid-cols-3 gap-8">
					<div>
						<h3 className="text-lg font-semibold mb-2">Translate with AI</h3>
						<p className="text-foreground-secondary">
							Translate text between languages with a single command.
						</p>
					</div>
					<div>
						<h3 className="text-lg font-semibold mb-2">UNIX-friendly</h3>
						<p className="text-foreground-secondary">
							Works with pipes. Combine with grep, sed, awk, and your favorite
							tools.
						</p>
					</div>
					<div>
						<h3 className="text-lg font-semibold mb-2">Git & Jujutsu</h3>
						<p className="text-foreground-secondary">
							Generate commit messages from your staged changes.
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
			</section>
		</main>
	);
}
