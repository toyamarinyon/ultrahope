"use client";

import { useState } from "react";
import { checkout } from "@/lib/auth/auth-client";

type UpgradeInfo = {
	subscriptionId: string;
	targetProductId: string;
};

type Props = {
	slug: string;
	planName: string;
	upgradeFrom?: UpgradeInfo;
	className?: string;
};

export function CheckoutButton({
	slug,
	planName,
	upgradeFrom,
	className,
}: Props) {
	const [isLoading, setIsLoading] = useState(false);

	const handleClick = async () => {
		setIsLoading(true);
		try {
			if (upgradeFrom) {
				const response = await fetch("/api/subscription/upgrade", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						subscriptionId: upgradeFrom.subscriptionId,
						targetProductId: upgradeFrom.targetProductId,
					}),
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || "Upgrade failed");
				}

				const data = await response.json();
				window.location.href = data.url;
			} else {
				await checkout({ slug });
			}
		} catch (error) {
			console.error("Checkout/upgrade failed:", error);
			alert(error instanceof Error ? error.message : "Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	const buttonText = isLoading
		? "Processing..."
		: upgradeFrom
			? `Upgrade to ${planName}`
			: slug === "free"
				? "Get Started"
				: `Subscribe to ${planName}`;

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isLoading}
			className={className}
		>
			{buttonText}
		</button>
	);
}
