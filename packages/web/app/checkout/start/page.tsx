import type { Metadata } from "next";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { SignOutButton } from "@/components/sign-out-button";
import { getAuth } from "@/lib/auth/auth";
import {
	createProCheckoutUrl,
	getAuthenticatedUserEntitlement,
} from "@/lib/billing/entitlement";
import { buildNoIndexMetadata } from "@/lib/util/seo";

export const metadata: Metadata = buildNoIndexMetadata({
	title: "Start Checkout",
	description: "Start the Pro checkout flow for Ultrahope.",
	path: "/checkout/start",
});

type CheckoutStartPageProps = {
	searchParams: Promise<{ returnTo?: string }>;
};

function normalizeReturnTo(returnTo: string | undefined): string | undefined {
	if (!returnTo || !returnTo.startsWith("/")) {
		return undefined;
	}
	return returnTo;
}

export default async function CheckoutStartPage({
	searchParams,
}: CheckoutStartPageProps) {
	const auth = getAuth();
	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		redirect("/login");
	}
	const isAnonymous =
		"isAnonymous" in session.user && session.user.isAnonymous === true;

	if (isAnonymous) {
		redirect("/login");
	}

	const entitlement = await getAuthenticatedUserEntitlement(session.user.id, {
		throwOnError: true,
	});

	if (entitlement === "pro") {
		redirect("/");
	}

	const params = await searchParams;
	const returnTo = normalizeReturnTo(params.returnTo);

	try {
		const checkoutUrl = await createProCheckoutUrl({
			userId: session.user.id,
			successPath: returnTo
				? `${returnTo}${
						returnTo.includes("?") ? "&" : "?"
					}checkout_id={CHECKOUT_ID}`
				: "/checkout/success?checkout_id={CHECKOUT_ID}",
			returnPath: "/account/access",
		});

		redirect(checkoutUrl);
	} catch (error) {
		if (isRedirectError(error)) {
			throw error;
		}

		const message =
			error instanceof Error
				? error.message
				: "Unable to start checkout right now.";

		return (
			<main className="min-h-screen px-8 py-24 flex items-center justify-center">
				<section className="w-full max-w-xl rounded-2xl border border-border-subtle bg-surface px-8 py-8">
					<p className="text-sm uppercase tracking-[0.2em] text-foreground-muted">
						Subscription required
					</p>
					<h1 className="mt-3 text-3xl font-black tracking-tight">
						Your account needs Pro
					</h1>
					<p className="mt-3 text-sm text-foreground-secondary">
						You need an active Pro subscription to continue using Ultrahope
						while signed in.
					</p>
					<p className="mt-4 rounded-md border border-red-400/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
						{message}
					</p>
					<div className="mt-6 flex flex-wrap gap-3">
						<SignOutButton />
						<Link
							href="/privacy"
							className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-hover"
						>
							Privacy
						</Link>
						<Link
							href="/terms"
							className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground no-underline hover:bg-surface-hover"
						>
							Terms
						</Link>
					</div>
					<div className="mt-8 border-t border-border-subtle pt-6">
						<h2 className="text-lg font-semibold text-red-500">
							Delete account
						</h2>
						<p className="mt-2 text-sm text-foreground-secondary">
							If you do not want to subscribe, you can delete this account.
						</p>
						<div className="mt-4">
							<DeleteAccountForm email={session.user.email} />
						</div>
					</div>
				</section>
			</main>
		);
	}
}
