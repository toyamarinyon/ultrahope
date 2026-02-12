"use client";

import { useState } from "react";

async function createCreditCheckout(amount: 10 | 20): Promise<string> {
	const response = await fetch("/api/billing/credits/checkout", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ amount: String(amount) }),
	});
	const data = (await response.json()) as { url?: string; error?: string };
	if (!response.ok || !data.url) {
		throw new Error(data.error ?? "Failed to create checkout.");
	}
	return data.url;
}

export function BillingSettingsControls() {
	const [isLoading10, setIsLoading10] = useState(false);
	const [isLoading20, setIsLoading20] = useState(false);
	const [checkoutError, setCheckoutError] = useState<string | null>(null);

	const handleTopUp = async (targetAmount: 10 | 20) => {
		setCheckoutError(null);
		targetAmount === 10 ? setIsLoading10(true) : setIsLoading20(true);
		try {
			const url = await createCreditCheckout(targetAmount);
			window.location.href = url;
		} catch (error) {
			setCheckoutError(
				error instanceof Error ? error.message : "Failed to create checkout.",
			);
		} finally {
			targetAmount === 10 ? setIsLoading10(false) : setIsLoading20(false);
		}
	};

	return (
		<div className="space-y-8">
			<div id="credits" className="space-y-3">
				<h3 className="text-lg font-semibold">Purchase credits</h3>
				<p className="text-sm text-foreground-secondary">
					Buy one-time credits that roll over.
				</p>
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						onClick={() => handleTopUp(10)}
						disabled={isLoading10 || isLoading20}
						className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isLoading10 ? "Opening..." : "Buy Credit $10"}
					</button>
					<button
						type="button"
						onClick={() => handleTopUp(20)}
						disabled={isLoading10 || isLoading20}
						className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isLoading20 ? "Opening..." : "Buy Credit $20"}
					</button>
				</div>
				{checkoutError ? (
					<p className="text-sm text-red-500">{checkoutError}</p>
				) : null}
			</div>
		</div>
	);
}
