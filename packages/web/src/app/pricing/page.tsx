import { headers } from "next/headers";
import Link from "next/link";
import { auth, polarClient } from "@/lib/auth";
import { CheckoutButton } from "./checkout-button";

const plans = [
	{
		name: "Free",
		price: "$0",
		description: "Get started with Ultrahope",
		features: [
			"$0.40 included credit/month",
			"Hard cap (no overage)",
			"Community support",
		],
		slug: "free",
	},
	{
		name: "Pro",
		price: "$10",
		description: "For power users",
		features: [
			"$5 included credit/month",
			"Pay-as-you-go overage at actual cost",
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

type SubscriptionInfo = {
	slug: string;
	subscriptionId: string;
	productId: string;
};

async function getActiveSubscriptions(
	userId: string,
): Promise<SubscriptionInfo[]> {
	try {
		const customerState = await polarClient.customers.getStateExternal({
			externalId: userId,
		});
		return customerState.activeSubscriptions
			.map((sub) => ({
				slug: productIdToSlug[sub.productId],
				subscriptionId: sub.id,
				productId: sub.productId,
			}))
			.filter((info): info is SubscriptionInfo => info.slug != null);
	} catch {
		return [];
	}
}

export default async function PricingPage() {
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const activeSubscriptions = session
		? await getActiveSubscriptions(session.user.id)
		: [];

	const activeSlugs = activeSubscriptions.map((s) => s.slug);
	const freeSubscription = activeSubscriptions.find((s) => s.slug === "free");

	return (
		<main className="min-h-screen px-8 py-16">
			<div className="max-w-5xl mx-auto">
				<header className="max-w-2xl">
					<p className="text-sm text-foreground-secondary uppercase tracking-wide mb-3">
						Pricing
					</p>
					<h1 className="text-4xl font-bold tracking-tight mb-4">Plans</h1>
					<p className="text-lg text-foreground-secondary">
						Choose the plan that fits your needs. Upgrade or downgrade any time.
					</p>
				</header>

				<section className="mt-12 grid gap-6 md:grid-cols-2">
					{plans.map((plan) => {
						const isActive = activeSlugs.includes(plan.slug);
						return (
							<article
								key={plan.name}
								className={`rounded-lg border ${
									isActive ? "border-foreground" : "border-border-subtle"
								} bg-surface p-6 flex flex-col gap-4`}
							>
								<div className="flex items-center justify-between">
									<h2 className="text-2xl font-semibold tracking-tight">
										{plan.name}
									</h2>
									{isActive && (
										<span className="text-xs text-foreground-secondary border border-border px-2 py-1 rounded-full">
											Current
										</span>
									)}
								</div>
								<p className="text-3xl font-semibold">
									{plan.price}
									<span className="text-base font-normal text-foreground-secondary">
										/month
									</span>
								</p>
								<p className="text-foreground-secondary">{plan.description}</p>
								<ul className="space-y-2 text-sm text-foreground-secondary">
									{plan.features.map((feature) => (
										<li key={feature}>• {feature}</li>
									))}
								</ul>
								{session ? (
									isActive ? (
										<span className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground-secondary rounded-md">
											Current Plan
										</span>
									) : (
										<CheckoutButton
											slug={plan.slug}
											planName={plan.name}
											className="inline-flex items-center justify-center px-4 py-2 bg-foreground text-canvas font-medium rounded-md hover:opacity-90 disabled:opacity-60"
											upgradeFrom={
												plan.slug === "pro" && freeSubscription
													? {
															subscriptionId: freeSubscription.subscriptionId,
															targetProductId:
																process.env.POLAR_PRODUCT_PRO_ID ?? "",
														}
													: undefined
											}
										/>
									)
								) : (
									<Link
										href="/login"
										className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover"
									>
										Sign in to subscribe
									</Link>
								)}
							</article>
						);
					})}
				</section>
			</div>
		</main>
	);
}
