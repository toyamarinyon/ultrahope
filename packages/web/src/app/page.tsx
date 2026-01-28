import { headers } from "next/headers";
import Link from "next/link";
import { MarketingHome } from "@/components/marketing-home";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";

export default async function RootPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		return <MarketingHome />;
	}

	return (
		<main className="min-h-screen px-8 py-12">
			<section className="max-w-6xl mx-auto">
				<div className="flex flex-col gap-10">
					<div className="relative overflow-hidden rounded-3xl border border-border-subtle bg-canvas-dark px-10 py-12">
						<div className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,_#2f2a22,_transparent_65%)] opacity-70 blur-2xl" />
						<p className="text-sm uppercase tracking-[0.2em] text-foreground-muted mb-4">
							Welcome back
						</p>
						<h1 className="text-5xl font-black tracking-tighter mb-4">
							Good to see you, {session.user.name ?? session.user.email}
						</h1>
						<p className="text-lg text-foreground-secondary max-w-2xl">
							Keep your UNIX workflow calm and focused. Here are the next steps
							we prepared for you.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								href="/pricing"
								className="inline-flex items-center justify-center px-6 py-3 bg-foreground text-canvas font-medium rounded-md no-underline hover:opacity-90"
							>
								Upgrade plan
							</Link>
							<Link
								href="/device"
								className="inline-flex items-center justify-center px-6 py-3 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface"
							>
								Register device
							</Link>
						</div>
					</div>

					<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
						<div className="rounded-2xl border border-border-subtle bg-surface px-8 py-8">
							<h2 className="text-2xl font-bold tracking-tight mb-6">
								Your quickstart
							</h2>
							<div className="space-y-6">
								<div>
									<p className="text-sm text-foreground-muted mb-2">
										Install Ultrahope CLI
									</p>
									<pre className="text-base">
										<code>npm install -g @ultrahope/cli</code>
									</pre>
								</div>
								<div>
									<p className="text-sm text-foreground-muted mb-2">
										Authenticate your terminal
									</p>
									<pre className="text-base">
										<code>ultrahope login</code>
									</pre>
								</div>
								<div className="flex flex-wrap gap-3 pt-2">
									<Link
										href="/device"
										className="inline-flex items-center justify-center px-5 py-2.5 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover"
									>
										Add another device
									</Link>
									<Link
										href="/pricing"
										className="inline-flex items-center justify-center px-5 py-2.5 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover"
									>
										Compare plans
									</Link>
								</div>
							</div>
						</div>

						<div className="flex flex-col gap-6">
							<div className="rounded-2xl border border-border-subtle bg-canvas-dark px-6 py-6">
								<h3 className="text-lg font-semibold mb-3">Session snapshot</h3>
								<p className="text-sm text-foreground-secondary mb-4">
									You are signed in as {session.user.email}
								</p>
								<div className="flex flex-wrap gap-2 text-xs text-foreground-muted">
									<span className="rounded-full border border-border-subtle px-3 py-1">
										CLI ready
									</span>
									<span className="rounded-full border border-border-subtle px-3 py-1">
										Plan active
									</span>
									<span className="rounded-full border border-border-subtle px-3 py-1">
										Sync idle
									</span>
								</div>
							</div>

							<div className="rounded-2xl border border-border-subtle bg-surface px-6 py-6">
								<h3 className="text-lg font-semibold mb-3">
									Need inspiration?
								</h3>
								<p className="text-sm text-foreground-secondary mb-4">
									Try a command and feel the warm glow of automated workflows.
								</p>
								<pre className="text-sm">
									<code>git ultrahope commit</code>
								</pre>
							</div>

							<div className="rounded-2xl border border-border-subtle bg-surface px-6 py-6">
								<h3 className="text-lg font-semibold mb-3">Account</h3>
								<p className="text-sm text-foreground-secondary mb-4">
									Manage billing or sign out anytime.
								</p>
								<div className="flex flex-wrap gap-3">
									<Link
										href="/pricing"
										className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover"
									>
										Billing
									</Link>
									<SignOutButton />
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</main>
	);
}
