"use client";

import Link from "next/link";
import { checkout, useSession } from "@/lib/auth-client";

const plans = [
	{
		name: "Free",
		price: "$0",
		description: "Get started with Ultrahope",
		features: ["10 requests/month", "Basic input size", "Community support"],
		slug: "free",
	},
	{
		name: "Pro",
		price: "$9",
		description: "For power users",
		features: [
			"100 requests/month",
			"Larger input size",
			"Priority support",
			"Early access to new features",
		],
		slug: "pro",
	},
	{
		name: "Team",
		price: "$29",
		description: "For teams and businesses",
		features: [
			"Unlimited requests",
			"Maximum input size",
			"Dedicated support",
			"Team management",
		],
		slug: "team",
	},
];

export default function PricingPage() {
	const { data: session } = useSession();

	const handleCheckout = async (slug: string) => {
		await checkout({ slug });
	};

	return (
		<main>
			<h1>Pricing</h1>
			<p>Choose the plan that fits your needs</p>

			<section style={{ display: "flex", gap: "2rem", marginTop: "2rem" }}>
				{plans.map((plan) => (
					<article
						key={plan.name}
						style={{
							border: "1px solid #ccc",
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
							<button type="button" onClick={() => handleCheckout(plan.slug)}>
								{plan.slug === "free"
									? "Get Started"
									: `Subscribe to ${plan.name}`}
							</button>
						) : (
							<Link href="/login">Sign in to subscribe</Link>
						)}
					</article>
				))}
			</section>
		</main>
	);
}
