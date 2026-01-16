import Link from "next/link";

export default function HomePage() {
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

			<Link href="/login">Get Started</Link>
		</main>
	);
}
