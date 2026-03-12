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
			aria-label="Table of contents"
		>
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
