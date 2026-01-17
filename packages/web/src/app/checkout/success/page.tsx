import Link from "next/link";

export default async function CheckoutSuccessPage({
	searchParams,
}: {
	searchParams: Promise<{ checkout_id?: string }>;
}) {
	const params = await searchParams;
	const checkoutId = params.checkout_id;

	return (
		<main>
			<h1>Thank you for your purchase!</h1>
			<p>Your subscription has been activated.</p>
			{checkoutId && (
				<p>
					<small>Checkout ID: {checkoutId}</small>
				</p>
			)}
			<Link href="/">Go to Dashboard</Link>
		</main>
	);
}
