import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/");
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

			<SignOutButton />
		</main>
	);
}
