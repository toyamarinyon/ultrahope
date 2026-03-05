"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
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
						<code className="flex-1 overflow-x-auto whitespace-nowrap text-[15px] font-medium text-foreground sm:text-base mr-3">
							{INSTALL_COMMAND}
						</code>
						<button
							type="button"
							onClick={copyInstallCommand}
							className="shrink-0 size-4 inline-flex items-center justify-center rounded-md"
							aria-label="Copy install command"
							title="Copy install command"
						>
							{installCopied ? (
								<CheckIcon className="text-foreground" />
							) : (
								<CopyIcon className="text-foreground-muted hover:text-foreground transition-colors" />
							)}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
