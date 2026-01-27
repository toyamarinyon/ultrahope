import { headers } from "next/headers";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function RootPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return (
			<main className="min-h-screen px-[--spacing-page]">
				{/* Hero */}
				<section className="flex flex-col justify-center min-h-[80vh] max-w-3xl">
					<h1 className="text-6xl font-black tracking-tighter mb-6">
						Ultrahope
					</h1>
					<p className="text-xl text-[--color-text-secondary] leading-relaxed mb-12 max-w-xl">
						LLM-powered development workflow assistant. A simple UNIX tool that
						works with pipes.
					</p>

					<div className="flex gap-4">
						<Link
							href="/login"
							className="inline-flex items-center justify-center px-6 py-3 bg-[--color-text] text-[--color-bg] font-medium rounded-[--radius-md] no-underline hover:opacity-90"
						>
							Get Started
						</Link>
						<Link
							href="/pricing"
							className="inline-flex items-center justify-center px-6 py-3 border border-[--color-border] text-[--color-text] font-medium rounded-[--radius-md] no-underline hover:bg-[--color-surface]"
						>
							Pricing
						</Link>
					</div>
				</section>

				{/* Features */}
				<section className="py-[--spacing-section] border-t border-[--color-border-subtle]">
					<h2 className="text-3xl font-bold tracking-tight mb-12">Features</h2>
					<div className="grid md:grid-cols-3 gap-8">
						<div>
							<h3 className="text-lg font-semibold mb-2">Translate with AI</h3>
							<p className="text-[--color-text-secondary]">
								Translate text between languages with a single command.
							</p>
						</div>
						<div>
							<h3 className="text-lg font-semibold mb-2">UNIX-friendly</h3>
							<p className="text-[--color-text-secondary]">
								Works with pipes. Combine with grep, sed, awk, and your favorite
								tools.
							</p>
						</div>
						<div>
							<h3 className="text-lg font-semibold mb-2">Git & Jujutsu</h3>
							<p className="text-[--color-text-secondary]">
								Generate commit messages from your staged changes.
							</p>
						</div>
					</div>
				</section>

				{/* Install */}
				<section className="py-[--spacing-section] border-t border-[--color-border-subtle]">
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

	return (
		<main className="min-h-screen px-[--spacing-page] py-12">
			<h1 className="text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
			<p className="text-[--color-text-secondary] mb-12">
				Welcome, {session.user.name ?? session.user.email}
			</p>

			<section className="mb-12">
				<h2 className="text-2xl font-bold tracking-tight mb-6">
					Get Started with CLI
				</h2>
				<p className="text-[--color-text-secondary] mb-4">
					Install Ultrahope CLI:
				</p>
				<pre className="mb-6">
					<code>npm install -g @ultrahope/cli</code>
				</pre>
				<p className="text-[--color-text-secondary] mb-4">Then authenticate:</p>
				<pre>
					<code>ultrahope login</code>
				</pre>
			</section>

			<section className="mb-12">
				<h2 className="text-2xl font-bold tracking-tight mb-4">Subscription</h2>
				<Link
					href="/pricing"
					className="inline-flex items-center justify-center px-6 py-3 border border-[--color-border] text-[--color-text] font-medium rounded-[--radius-md] no-underline hover:bg-[--color-surface]"
				>
					View Plans
				</Link>
			</section>

			<SignOutButton />
		</main>
	);
}
