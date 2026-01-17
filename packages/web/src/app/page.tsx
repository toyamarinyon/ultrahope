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
			<main>
				<h1>Ultrahope</h1>
				<p>LLM-powered development workflow assistant</p>

				<section>
					<h2>Features</h2>
					<ul>
						<li>Translate text with AI</li>
						<li>Simple UNIX-friendly CLI</li>
						<li>Pipe-based workflow integration</li>
					</ul>
				</section>

				<p>
					<Link href="/login">Get Started</Link> |{" "}
					<Link href="/pricing">Pricing</Link>
				</p>
			</main>
		);
	}

	return (
		<main>
			<h1>Dashboard</h1>
			<p>Welcome, {session.user.name ?? session.user.email}</p>

			<section>
				<h2>Get Started with CLI</h2>
				<p>Install Ultrahope CLI:</p>
				<pre>
					<code>npm install -g @ultrahope/cli</code>
				</pre>
				<p>Then authenticate:</p>
				<pre>
					<code>ultrahope login</code>
				</pre>
			</section>

			<section>
				<h2>Subscription</h2>
				<p>
					<Link href="/pricing">View Plans</Link>
				</p>
			</section>

			<SignOutButton />
		</main>
	);
}
