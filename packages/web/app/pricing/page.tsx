import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { getAuth, getPolarClient } from "@/lib/auth/auth";
import { getActiveSubscriptions } from "@/lib/billing/billing";
import { CheckoutButton } from "./checkout-button";
import { ResetTime } from "./reset-time";

export const metadata: Metadata = {
	title: "Pricing",
	description:
		"Compare Ultrahope plans and choose the workflow support level that fits your team.",
	alternates: {
		canonical: "/pricing",
	},
	openGraph: {
		title: "Ultrahope Pricing",
		description:
			"Compare Ultrahope plans and choose the workflow support level that fits your team.",
		url: "/pricing",
	},
	twitter: {
		card: "summary",
		title: "Ultrahope Pricing",
		description:
			"Compare Ultrahope plans and choose the workflow support level that fits your team.",
	},
};

export const dynamic = "force-dynamic";

const plans = [
	{
		name: "Free",
		price: "$0",
		description: "Sign in for the free plan or try the CLI anonymously first",
		features: [
			{ key: "requests", content: "5 requests/day" },
			{ key: "inputLimit", content: "40000 character input limit per request" },
			{ key: "trial", content: "CLI trial: 5 runs without login" },
			{ key: "reset", content: <ResetTime /> },
			{ key: "support", content: "Community support" },
		],
		slug: "free",
	},
	{
		name: "Pro",
		price: "$3",
		description: "For power users",
		features: [
			{ key: "requests", content: "Unlimited requests" },
			{ key: "credits", content: "$1 included credit/month" },
			{ key: "overage", content: "Pay-as-you-go overage at actual cost" },
			{ key: "support", content: "Priority support" },
		],
		slug: "pro",
	},
];

type LegacyFreeSubscription = {
	subscriptionId: string;
};

async function getLegacyFreeSubscription(
	userId: string,
): Promise<LegacyFreeSubscription | null> {
	const freeProductId = process.env.POLAR_PRODUCT_FREE_ID;
	if (!freeProductId) {
		return null;
	}

	try {
		const polarClient = getPolarClient();
		const customerState = await polarClient.customers.getStateExternal({
			externalId: userId,
		});
		const subscription = customerState.activeSubscriptions.find(
			(sub) => sub.productId === freeProductId,
		);
		if (!subscription) {
			return null;
		}
		return {
			subscriptionId: subscription.id,
		};
	} catch (error) {
		if (error instanceof ResourceNotFound) {
			return null;
		}
		return null;
	}
}

export default async function PricingPage() {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const [activePaidSubscriptions, legacyFreeSubscription] = session
		? await Promise.all([
				getActiveSubscriptions(session.user.id),
				getLegacyFreeSubscription(session.user.id),
			])
		: [[], null];
	const currentPlan = activePaidSubscriptions.some(
		(subscription) => subscription.plan === "pro",
	)
		? "pro"
		: session
			? "free"
			: null;

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
						const isCurrent = currentPlan === plan.slug;
						return (
							<article
								key={plan.name}
								className={`rounded-lg border ${
									isCurrent ? "border-foreground" : "border-border-subtle"
								} bg-surface p-6 flex flex-col gap-4`}
							>
								<div className="flex items-center justify-between">
									<h2 className="text-2xl font-semibold tracking-tight">
										{plan.name}
									</h2>
									{isCurrent && (
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
										<li key={feature.key}>• {feature.content}</li>
									))}
								</ul>
								{session ? (
									isCurrent ? (
										<span className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground-secondary rounded-md">
											Current Plan
										</span>
									) : plan.slug === "free" ? (
										<span className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground-secondary rounded-md">
											Included with your account
										</span>
									) : (
										<CheckoutButton
											slug={plan.slug}
											planName={plan.name}
											className="inline-flex items-center justify-center px-4 py-2 bg-foreground text-canvas font-medium rounded-md hover:opacity-90 disabled:opacity-60"
											upgradeFrom={
												plan.slug === "pro" && legacyFreeSubscription
													? {
															subscriptionId:
																legacyFreeSubscription.subscriptionId,
															targetProductId:
																process.env.POLAR_PRODUCT_PRO_ID ?? "",
														}
													: undefined
											}
										/>
									)
								) : plan.slug === "free" ? (
									<Link
										href="/signup"
										className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover"
									>
										Create free account
									</Link>
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

				<div className="mt-10 text-sm text-foreground-secondary">
					<Link href="/privacy" className="hover:opacity-80">
						Privacy Policy
					</Link>
					<span className="mx-2">·</span>
					<Link href="/terms" className="hover:opacity-80">
						Terms of Use
					</Link>
				</div>
			</div>
		</main>
	);
}
