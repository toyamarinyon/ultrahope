"use client";

import { checkout } from "@/lib/auth-client";

type Props = {
	slug: string;
	planName: string;
};

export function CheckoutButton({ slug, planName }: Props) {
	const handleCheckout = async () => {
		await checkout({ slug });
	};

	return (
		<button type="button" onClick={handleCheckout}>
			{slug === "free" ? "Get Started" : `Subscribe to ${planName}`}
		</button>
	);
}
