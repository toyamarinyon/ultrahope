import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DocsNav, type TocEntry } from "@/components/docs-nav";

export const metadata: Metadata = {
	title: "Documentation",
	description:
		"Complete reference for the Ultrahope CLI — installation, commands, configuration, and authentication.",
	alternates: {
		canonical: "/docs",
	},
	openGraph: {
		title: "Ultrahope Documentation",
		description:
			"Complete reference for the Ultrahope CLI — installation, commands, configuration, and authentication.",
		url: "/docs",
	},
	twitter: {
		card: "summary",
		title: "Ultrahope Documentation",
		description:
			"Complete reference for the Ultrahope CLI — installation, commands, configuration, and authentication.",
	},
};

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^\w\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.trim();
}

function extractToc(markdown: string): TocEntry[] {
	const entries: TocEntry[] = [];
	for (const match of markdown.matchAll(/^(#{2,3})\s+(.+)$/gm)) {
		const level = match[1].length;
		const text = match[2].trim();
		entries.push({ id: slugify(text), text, level });
	}
	return entries;
}

export default function DocsPage() {
	const mdPath = path.join(process.cwd(), "app/docs/docs.md");
	const content = fs.readFileSync(mdPath, "utf-8");
	const toc = extractToc(content);

	return (
		<main className="min-h-screen px-8 py-12">
			<div className="mx-auto w-full max-w-6xl">
				<Link
					href="/"
					className="inline-block text-3xl font-black tracking-tighter mb-10 no-underline hover:opacity-80 transition-opacity"
					aria-label="Go to Ultrahope top page"
				>
					ULTRAHOPE
				</Link>

				<div className="flex gap-16">
					<aside className="w-56 shrink-0">
						<DocsNav entries={toc} />
					</aside>

					<article className="docs-content min-w-0 max-w-3xl flex-1">
						<Markdown
							remarkPlugins={[remarkGfm]}
							components={{
								h1: ({ children }) => (
									<h1 className="text-3xl font-bold tracking-tight mb-6">
										{children}
									</h1>
								),
								h2: ({ children }) => {
									const text =
										typeof children === "string" ? children : String(children);
									return (
										<h2
											id={slugify(text)}
											className="text-2xl font-semibold tracking-tight mt-16 mb-4 scroll-mt-20"
										>
											{text}
										</h2>
									);
								},
								h3: ({ children }) => {
									const text =
										typeof children === "string" ? children : String(children);
									return (
										<h3
											id={slugify(text)}
											className="text-lg font-semibold mt-10 mb-3 scroll-mt-20"
										>
											{text}
										</h3>
									);
								},
								h4: ({ children }) => (
									<h4 className="text-base font-semibold mt-6 mb-2">
										{children}
									</h4>
								),
							}}
						>
							{content}
						</Markdown>
					</article>
				</div>
			</div>
		</main>
	);
}
