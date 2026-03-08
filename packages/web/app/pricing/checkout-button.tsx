"use client";

import { useState } from "react";
import { checkout } from "@/lib/auth/auth-client";

type Props = {
	slug: string;
	planName: string;
	className?: string;
};

export function CheckoutButton({ slug, planName, className }: Props) {
	const [isLoading, setIsLoading] = useState(false);

	const handleClick = async () => {
		setIsLoading(true);
		try {
			await checkout({ slug });
		} catch (error) {
			console.error("Checkout failed:", error);
			alert(error instanceof Error ? error.message : "Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	const buttonText = isLoading
		? "Processing..."
		: slug === "anonymous"
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
