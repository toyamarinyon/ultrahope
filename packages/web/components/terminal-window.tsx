"use client";

import type { ReactNode } from "react";

type TerminalWindowProps = {
	title?: string;
	className?: string;
	children: ReactNode;
};

const BASE_TERMINAL_WINDOW_CLASS =
	"overflow-hidden rounded-xl border border-border-subtle bg-canvas-dark";

export function TerminalWindow({
	title = "ultrahope",
	className,
	children,
}: TerminalWindowProps) {
	const rootClassName = className
		? `${BASE_TERMINAL_WINDOW_CLASS} ${className}`
		: BASE_TERMINAL_WINDOW_CLASS;

	return (
		<div className={rootClassName}>
			<div className="flex items-center justify-between border-b border-border-subtle bg-surface px-3 py-2">
				<div className="flex items-center gap-2">
					<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/60" />
					<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/40" />
					<span className="h-2.5 w-2.5 rounded-full bg-foreground-muted/30" />
				</div>
				<span className="text-[11px] text-foreground-secondary">{title}</span>
			</div>
			{children}
		</div>
	);
}
