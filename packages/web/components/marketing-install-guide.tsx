"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INSTALL_COMMAND = "npm i -g ultrahope";

export function MarketingInstallGuide() {
	const [installCopied, setInstallCopied] = useState(false);
	const installCopyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	const copyInstallCommand = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(INSTALL_COMMAND);
			if (installCopyTimeoutRef.current) {
				clearTimeout(installCopyTimeoutRef.current);
			}
			setInstallCopied(true);
			installCopyTimeoutRef.current = setTimeout(() => {
				setInstallCopied(false);
			}, 1200);
		} catch {
			// Ignore clipboard failures and keep rendering unchanged.
		}
	}, []);

	useEffect(() => {
		return () => {
			if (installCopyTimeoutRef.current) {
				clearTimeout(installCopyTimeoutRef.current);
			}
		};
	}, []);

	return (
		<div className="mt-6 sm:mt-8 flex flex-col items-center">
			<div>
				<p className="text-center text-sm text-foreground-muted">
					Install and run it locally
				</p>
				<div className="mt-3 rounded-xl border border-border-subtle bg-canvas-dark">
					<div className="flex items-center gap-3 px-4 py-3 sm:px-5">
						<code className="flex-1 overflow-x-auto whitespace-nowrap text-[15px] font-medium text-foreground sm:text-base">
							{INSTALL_COMMAND}
						</code>
						<button
							type="button"
							onClick={copyInstallCommand}
							className="shrink-0 size-8 inline-flex items-center justify-center rounded-md text-foreground-muted transition-colors hover:text-foreground"
							aria-label="Copy install command"
							title="Copy install command"
						>
							{installCopied ? (
								<svg
									width="16"
									height="16"
									viewBox="0 0 16 16"
									fill="none"
									aria-hidden="true"
								>
									<path
										d="M3.5 8.5L6.5 11.5L12.5 5.5"
										stroke="currentColor"
										strokeWidth="1.5"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
							) : (
								<svg
									width="16"
									height="16"
									viewBox="0 0 16 16"
									fill="none"
									aria-hidden="true"
								>
									<rect
										x="5.5"
										y="5.5"
										width="7"
										height="7"
										rx="1.5"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
									<path
										d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"
										stroke="currentColor"
										strokeWidth="1.5"
									/>
								</svg>
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
