import { headers } from "next/headers";
import Link from "next/link";
import { auth, polarClient } from "@/lib/auth";
import { CheckoutButton } from "./checkout-button";

const plans = [
	{
		name: "Free",
		price: "$0",
		description: "Get started with Ultrahope",
		features: ["400,000 tokens/month", "Community support"],
		slug: "free",
	},
	{
		name: "Pro",
		price: "$9",
		description: "For power users",
		features: [
			"1,000,000 tokens/month",
			"Priority support",
			"Early access to new features",
		],
		slug: "pro",
	},
];

const productIdToSlug: Record<string, string> = {
	[process.env.POLAR_PRODUCT_FREE_ID ?? ""]: "free",
	[process.env.POLAR_PRODUCT_PRO_ID ?? ""]: "pro",
};

async function getActiveSubscriptions(userId: string): Promise<string[]> {
	try {
		const customerState = await polarClient.customers.getStateExternal({
			externalId: userId,
		});
		return customerState.activeSubscriptions
			.map((sub) => productIdToSlug[sub.productId])
			.filter((slug): slug is string => slug != null);
	} catch {
		return [];
	}
}

export default async function PricingPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const activeSlugs = session
		? await getActiveSubscriptions(session.user.id)
		: [];

	return (
		<main>
			<h1>Pricing</h1>
			<p>Choose the plan that fits your needs</p>

			<section style={{ display: "flex", gap: "2rem", marginTop: "2rem" }}>
				{plans.map((plan) => {
					const isActive = activeSlugs.includes(plan.slug);
					return (
						<article
							key={plan.name}
							style={{
								border: isActive ? "2px solid #22c55e" : "1px solid #ccc",
								padding: "1.5rem",
								borderRadius: "8px",
								flex: 1,
							}}
						>
							<h2>{plan.name}</h2>
							<p style={{ fontSize: "2rem", fontWeight: "bold" }}>
								{plan.price}
								<span style={{ fontSize: "1rem", fontWeight: "normal" }}>
									/month
								</span>
							</p>
							<p>{plan.description}</p>
							<ul>
								{plan.features.map((feature) => (
									<li key={feature}>{feature}</li>
								))}
							</ul>
							{session ? (
								isActive ? (
									<span
										style={{
											display: "inline-block",
											padding: "0.5rem 1rem",
											background: "#22c55e",
											color: "white",
											borderRadius: "4px",
										}}
									>
										Current Plan
									</span>
								) : (
									<CheckoutButton slug={plan.slug} planName={plan.name} />
								)
							) : (
								<Link href="/login">Sign in to subscribe</Link>
							)}
						</article>
					);
				})}
			</section>
		</main>
	);
}
