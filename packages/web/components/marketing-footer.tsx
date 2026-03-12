import Link from "next/link";
import { MarketingInstallCommand } from "./marketing-install-command";

export function MarketingFooter() {
	return (
		<footer className="border-t border-border-subtle">
			<div className="max-w-7xl mx-auto px-4 sm:px-8 py-20 sm:py-28">
				<div className="flex flex-col items-center gap-16">
					{/* CTA area */}
					<div className="flex flex-col items-center gap-6">
						<div className="flex flex-col items-center gap-3">
							<h2 className="text-2xl font-medium font-serif sm:text-3xl">
								Try it on your next commit.
							</h2>
							<p className="text-lg text-foreground-secondary">
								Install once, run from any repo. Multiple proposals, your
								choice.
							</p>
						</div>
						<MarketingInstallCommand />
					</div>

					{/* Links */}
					<div className="flex gap-16 text-sm mt-8">
						<div className="flex flex-col gap-3">
							<Link
								href="/docs"
								className="text-foreground-secondary hover:text-foreground transition-colors"
							>
								Docs
							</Link>
							<Link
								href="/docs#quickstart"
								className="text-foreground-secondary hover:text-foreground transition-colors"
							>
								Get Started
							</Link>
							<Link
								href="/login"
								className="text-foreground-secondary hover:text-foreground transition-colors"
							>
								Login
							</Link>
							<Link
								href="/pricing"
								className="text-foreground-secondary hover:text-foreground transition-colors"
							>
								Pricing
							</Link>
							<Link
								href="/models"
								className="text-foreground-secondary hover:text-foreground transition-colors"
							>
								Models
							</Link>
						</div>
						<div className="flex flex-col gap-3">
							<Link
								href="https://github.com/toyamarinyon/ultrahope"
								className="text-foreground-secondary hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
							>
								GitHub
							</Link>
							<Link
								href="https://x.com/toyamarinyon"
								className="text-foreground-secondary hover:text-foreground transition-colors"
								target="_blank"
								rel="noopener noreferrer"
							>
								X
							</Link>
						</div>
						<div className="flex flex-col gap-3">
							<Link
								href="/privacy"
								className="text-foreground-secondary hover:text-foreground transition-colors"
							>
								Privacy Policy
							</Link>
							<Link
								href="/terms"
								className="text-foreground-secondary hover:text-foreground transition-colors"
							>
								Terms of Use
							</Link>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
}
