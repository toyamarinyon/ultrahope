import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getAuth } from "@/lib/auth/auth";
import { getActiveSubscriptions } from "@/lib/billing/billing";
import { getAuthenticatedUserEntitlement } from "@/lib/billing/entitlement";
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

function ModelTierTooltip(props: {
	label: string;
	tier: "default" | "pro";
	description: string;
}) {
	return (
		<span className="group relative inline-flex">
			<button
				type="button"
				aria-label={`${props.tier} tier details`}
				className="decoration-border inline text-current underline decoration-dotted underline-offset-3 outline-none transition-colors hover:text-foreground focus:text-foreground"
			>
				{props.label}
			</button>
			<span className="pointer-events-none absolute left-0 top-full z-10 w-64 pt-2 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
				<span className="block rounded-lg border border-border-subtle bg-canvas px-3 py-2 text-xs leading-5 text-foreground shadow-lg">
					{props.description}{" "}
					<Link href="/models" className="underline underline-offset-2">
						See models
					</Link>
					.
				</span>
			</span>
		</span>
	);
}

const plans = [
	{
		name: "Free",
		price: "$0",
		description: (
			<>
				Use the{" "}
				<ModelTierTooltip
					label="default model tier"
					tier="default"
					description="The default tier is used for standard CLI generation and is available on the Free plan."
				/>{" "}
				in the CLI before subscribing
			</>
		),
		features: [
			{ key: "requests", content: "5 requests/day" },
			{ key: "inputLimit", content: "40000 character input limit per request" },
			{ key: "access", content: "Default-tier CLI generation" },
			{ key: "anonymous", content: "No login required in the CLI" },
			{ key: "reset", content: <ResetTime /> },
			{ key: "support", content: "Community support" },
		],
		slug: "anonymous",
	},
	{
		name: "Pro",
		price: "$3",
		description: (
			<>
				Unlock{" "}
				<ModelTierTooltip
					label="Pro-tier models"
					tier="pro"
					description="The Pro tier is used when you escalate from the selector for a stronger second pass and requires the Pro plan."
				/>{" "}
				for escalation and stronger generations
			</>
		),
		features: [
			{ key: "requests", content: "Unlimited requests" },
			{ key: "models", content: "Access to Pro-tier models" },
			{ key: "credits", content: "$1 included credit/month" },
			{ key: "overage", content: "Pay-as-you-go overage at actual cost" },
			{ key: "support", content: "Priority support" },
		],
		slug: "pro",
	},
] satisfies Array<{
	name: string;
	price: string;
	description: ReactNode;
	features: Array<{ key: string; content: ReactNode }>;
	slug: "anonymous" | "pro";
}>;

export default async function PricingPage() {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	const isAnonymous =
		session &&
		"isAnonymous" in session.user &&
		session.user.isAnonymous === true;

	if (session && !isAnonymous) {
		const entitlement = await getAuthenticatedUserEntitlement(session.user.id, {
			throwOnError: true,
		});
		if (entitlement !== "pro") {
			redirect("/checkout/start?returnTo=%2Fpricing");
		}
	}

	const activePaidSubscriptions = session
		? await getActiveSubscriptions(session.user.id)
		: [];
	const currentPlan = activePaidSubscriptions.some(
		(subscription) => subscription.plan === "pro",
	)
		? "pro"
		: session
			? "anonymous"
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
						Choose the plan that fits your CLI workflow. Upgrade or downgrade
						any time.
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
								{plan.slug === "anonymous" ? (
									<Link
										href="https://github.com/toyamarinyon/ultrahope"
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground font-medium rounded-md no-underline hover:bg-surface-hover"
									>
										Use in CLI
									</Link>
								) : session ? (
									isCurrent ? (
										<span className="inline-flex items-center justify-center px-4 py-2 border border-border text-foreground-secondary rounded-md">
											Current Plan
										</span>
									) : (
										<CheckoutButton
											slug={plan.slug}
											planName={plan.name}
											className="inline-flex items-center justify-center px-4 py-2 bg-foreground text-canvas font-medium rounded-md hover:opacity-90 disabled:opacity-60"
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
