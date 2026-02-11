"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DowngradePlanButton() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const handleClick = async () => {
		setError(null);
		setSuccess(null);

		const ok = window.confirm(
			"Downgrade to Free now? Your Pro subscription will be cancelled immediately.",
		);
		if (!ok) {
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch("/api/subscription/downgrade", {
				method: "POST",
			});
			const data = (await response.json()) as {
				error?: string;
				message?: string;
			};
			if (!response.ok) {
				setError(data.error ?? "Failed to downgrade plan.");
				return;
			}

			setSuccess(data.message ?? "Downgraded to Free plan.");
			router.refresh();
		} catch (submissionError) {
			setError(
				submissionError instanceof Error
					? submissionError.message
					: "Failed to downgrade plan.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-2">
			<button
				type="button"
				onClick={handleClick}
				disabled={isLoading}
				className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
			>
				{isLoading ? "Downgrading..." : "Downgrade to Free"}
			</button>
			{error ? <p className="text-sm text-red-500">{error}</p> : null}
			{success ? <p className="text-sm text-emerald-500">{success}</p> : null}
		</div>
	);
}
