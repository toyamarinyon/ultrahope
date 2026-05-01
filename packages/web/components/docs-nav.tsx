"use client";

import { useEffect, useRef, useState } from "react";

export interface TocEntry {
	id: string;
	text: string;
	level: number;
}

export function DocsNav({ entries }: { entries: TocEntry[] }) {
	const [activeId, setActiveId] = useState<string>("");
	const observerRef = useRef<IntersectionObserver | null>(null);

	useEffect(() => {
		const headings = entries
			.map((e) => document.getElementById(e.id))
			.filter(Boolean) as HTMLElement[];

		if (headings.length === 0) return;

		observerRef.current = new IntersectionObserver(
			(intersections) => {
				for (const entry of intersections) {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id);
						break;
					}
				}
			},
			{ rootMargin: "-80px 0px -60% 0px", threshold: 0 },
		);

		for (const heading of headings) {
			observerRef.current.observe(heading);
		}

		return () => observerRef.current?.disconnect();
	}, [entries]);

	return (
		<nav
			className="hidden lg:block sticky top-12 max-h-[calc(100vh-6rem)] overflow-y-auto text-sm"
			aria-label="Halo docs navigation"
		>
			<div className="mb-6 border-b border-border-subtle pb-4">
				<p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-foreground-muted">
					Halo CLI
				</p>
				<div className="space-y-1">
					<a
						href="/"
						className="block no-underline py-1 text-foreground-muted transition-colors hover:text-foreground-secondary"
					>
						Overview
					</a>
					<a
						href="/pricing"
						className="block no-underline py-1 text-foreground-muted transition-colors hover:text-foreground-secondary"
					>
						Pricing
					</a>
					<a
						href="#quickstart"
						className="block no-underline py-1 text-foreground-muted transition-colors hover:text-foreground-secondary"
					>
						Install
					</a>
				</div>
			</div>
			<ul className="space-y-1">
				{entries.map((entry) => (
					<li key={entry.id}>
						<a
							href={`#${entry.id}`}
							className={`block no-underline py-1 transition-colors ${
								entry.level === 3 ? "pl-4" : ""
							} ${
								activeId === entry.id
									? "text-foreground"
									: "text-foreground-muted hover:text-foreground-secondary"
							}`}
						>
							{entry.text}
						</a>
					</li>
				))}
			</ul>
		</nav>
	);
}
