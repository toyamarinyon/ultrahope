import type { Metadata } from "next";
import Link from "next/link";
import { buildNoIndexMetadata } from "@/lib/util/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Checkout Success",
	description: "Post-checkout confirmation page for Ultrahope subscriptions.",
	path: "/checkout/success",
});

export default async function CheckoutSuccessPage({
	searchParams,
}: {
	searchParams: Promise<{ checkout_id?: string; upgraded?: string }>;
}) {
	const params = await searchParams;
	const checkoutId = params.checkout_id;
	const isUpgrade = params.upgraded === "true";

	return (
		<main className="min-h-screen px-8 py-24 flex items-center justify-center">
			<div className="w-full max-w-lg border border-border-subtle bg-surface rounded-lg p-10">
				<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
					Payment complete
				</p>
				<h1 className="text-3xl font-bold tracking-tight mb-3">
					{isUpgrade ? "Upgrade successful!" : "Thank you for your purchase!"}
				</h1>
				<p className="text-foreground-secondary mb-8">
					{isUpgrade
						? "Your subscription has been upgraded to Pro."
						: "Your subscription has been activated."}
				</p>
				{checkoutId && (
					<p className="text-sm text-foreground-muted mb-8">
						Checkout ID: {checkoutId}
					</p>
				)}
				<Link
					href="/"
					className="inline-flex items-center justify-center px-5 py-3 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover"
				>
					Go to Dashboard
				</Link>
			</div>
		</main>
	);
}
