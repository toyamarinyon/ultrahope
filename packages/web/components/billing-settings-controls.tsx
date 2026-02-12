"use client";

import { useMemo, useState } from "react";

type Props = {
	initialAutoRecharge: {
		enabled: boolean;
		thresholdUsd: number;
		amount: 10 | 20;
	};
};

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

export function BillingSettingsControls({ initialAutoRecharge }: Props) {
	const [isLoading10, setIsLoading10] = useState(false);
	const [isLoading20, setIsLoading20] = useState(false);
	const [checkoutError, setCheckoutError] = useState<string | null>(null);

	const [enabled, setEnabled] = useState(initialAutoRecharge.enabled);
	const [thresholdUsd, setThresholdUsd] = useState(
		initialAutoRecharge.thresholdUsd.toFixed(2),
	);
	const [amount, setAmount] = useState<10 | 20>(initialAutoRecharge.amount);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

	const parsedThreshold = useMemo(() => {
		const parsed = Number.parseFloat(thresholdUsd);
		return Number.isFinite(parsed) ? parsed : NaN;
	}, [thresholdUsd]);

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

	const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setSaveError(null);
		setSaveSuccess(null);

		if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0) {
			setSaveError("Threshold must be a non-negative number.");
			return;
		}

		setIsSaving(true);
		try {
			const response = await fetch("/api/settings/auto-recharge", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					enabled,
					thresholdUsd: parsedThreshold,
					amount: String(amount),
				}),
			});
			const data = (await response.json()) as {
				error?: string;
				thresholdUsd?: number;
			};
			if (!response.ok) {
				setSaveError(data.error ?? "Failed to save settings.");
				return;
			}
			if (typeof data.thresholdUsd === "number") {
				setThresholdUsd(data.thresholdUsd.toFixed(2));
			}
			setSaveSuccess("Auto-recharge settings saved.");
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : "Failed to save.");
		} finally {
			setIsSaving(false);
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

			<form id="auto-recharge" className="space-y-4" onSubmit={handleSave}>
				<h3 className="text-lg font-semibold">Auto-recharge</h3>
				<p className="text-sm text-foreground-secondary">
					Automatically open a recharge checkout when your balance crosses a
					threshold.
				</p>
				<label className="flex items-center gap-2 text-sm text-foreground">
					<input
						type="checkbox"
						checked={enabled}
						onChange={(event) => setEnabled(event.target.checked)}
						disabled={isSaving}
					/>
					Enable auto-recharge
				</label>
				<label className="block space-y-2">
					<span className="text-sm font-medium text-foreground">
						Threshold (USD)
					</span>
					<input
						type="number"
						min="0"
						step="0.01"
						value={thresholdUsd}
						onChange={(event) => setThresholdUsd(event.target.value)}
						disabled={isSaving}
						className="w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-border-subtle"
					/>
				</label>
				<label className="block space-y-2">
					<span className="text-sm font-medium text-foreground">
						Recharge amount
					</span>
					<select
						value={String(amount)}
						onChange={(event) =>
							setAmount(event.target.value === "20" ? 20 : 10)
						}
						disabled={isSaving}
						className="w-full rounded-md border border-border bg-canvas px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-border-subtle"
					>
						<option value="10">$10 credit</option>
						<option value="20">$20 credit</option>
					</select>
				</label>
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={isSaving}
						className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
					>
						{isSaving ? "Saving..." : "Save auto-recharge"}
					</button>
					{saveSuccess ? (
						<span className="text-sm text-emerald-500">{saveSuccess}</span>
					) : null}
				</div>
				{saveError ? <p className="text-sm text-red-500">{saveError}</p> : null}
			</form>
		</div>
	);
}
