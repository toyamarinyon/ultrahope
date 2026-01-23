import Link from "next/link";

export default async function CheckoutSuccessPage({
	searchParams,
}: {
	searchParams: Promise<{ checkout_id?: string; upgraded?: string }>;
}) {
	const params = await searchParams;
	const checkoutId = params.checkout_id;
	const isUpgrade = params.upgraded === "true";

	return (
		<main>
			<h1>
				{isUpgrade ? "Upgrade successful!" : "Thank you for your purchase!"}
			</h1>
			<p>
				{isUpgrade
					? "Your subscription has been upgraded to Pro."
					: "Your subscription has been activated."}
			</p>
			{checkoutId && (
				<p>
					<small>Checkout ID: {checkoutId}</small>
				</p>
			)}
			<Link href="/">Go to Dashboard</Link>
		</main>
	);
}
