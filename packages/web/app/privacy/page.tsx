import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";

export const metadata: Metadata = {
	title: "Privacy Policy | Ultrahope",
	description: "Ultrahope Privacy Policy",
};

export default function PrivacyPage() {
	const mdPath = path.join(process.cwd(), "app/privacy/privacy.md");
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
