import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DocsNav, type TocEntry } from "@/components/docs-nav";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
	title: "Halo CLI Documentation",
	description:
		"Complete reference for the Halo CLI — installation, commands, configuration, and authentication.",
	keywords: [
		"Halo CLI docs",
		"Halo CLI documentation",
		"Ultrahope docs",
		"git halo commit",
		"jj halo",
	],
	alternates: {
		canonical: "/docs",
	},
	openGraph: {
		title: "Halo CLI Documentation | Ultrahope",
		description:
			"Complete reference for the Halo CLI — installation, commands, configuration, and authentication.",
		url: "/docs",
	},
	twitter: {
		card: "summary",
		title: "Halo CLI Documentation | Ultrahope",
		description:
			"Complete reference for the Halo CLI — installation, commands, configuration, and authentication.",
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

function HaloDocsMark() {
	return (
		<span className="inline-flex items-center gap-2">
			<span className="inline-flex size-8 shrink-0 items-center justify-center text-foreground sm:size-10">
				<Logo className="h-7 w-7 sm:h-9 sm:w-9" />
			</span>
			<span className="flex min-w-0 flex-col justify-center gap-px leading-none">
				<span className="text-xl tracking-tighter sm:text-2xl font-logo">
					Halo
				</span>
				<span className="text-[0.62rem] font-medium text-foreground-muted sm:text-[0.68rem]">
					CLI docs by Ultrahope
				</span>
			</span>
		</span>
	);
}

export default function DocsPage() {
	const mdPath = path.join(process.cwd(), "app/docs/docs.md");
	const content = fs.readFileSync(mdPath, "utf-8");
	const toc = extractToc(content);

	return (
		<main className="min-h-screen px-4 pb-12 sm:px-8">
			<div className="mx-auto w-full max-w-7xl">
				<header>
					<div className="h-20 flex items-center justify-between gap-4">
						<Link
							href="/"
							className="text-foreground no-underline"
							aria-label="Go to Halo docs top page"
						>
							<HaloDocsMark />
						</Link>
					</div>
				</header>

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
