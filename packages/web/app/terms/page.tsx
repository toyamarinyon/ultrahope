import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";

export const metadata: Metadata = {
	title: "Terms of Use | Ultrahope",
	description: "Ultrahope Terms of Use",
};

export default function TermsPage() {
	const mdPath = path.join(process.cwd(), "app/terms/terms.md");
	const content = fs.readFileSync(mdPath, "utf-8");

	return (
		<main className="min-h-screen px-8 py-12">
			<div className="mx-auto w-full max-w-5xl">
				<Link
					href="/"
					className="inline-block text-3xl font-black tracking-tighter mb-6 no-underline hover:opacity-80 transition-opacity"
					aria-label="Go to Ultrahope top page"
				>
					ULTRAHOPE
				</Link>
				<article className="privacy-content">
					<Markdown>{content}</Markdown>
				</article>
			</div>
		</main>
	);
}
