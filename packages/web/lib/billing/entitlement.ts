import { eq } from "drizzle-orm";
import { getDb, user } from "@/db";
import { getPolarClient } from "@/lib/auth/auth";
import { resolveBaseURL } from "@/lib/util/base-url";
import { getActiveSubscriptions } from "./billing";

export type AuthenticatedEntitlement = "pro" | "authenticated_unpaid";
export async function getAuthenticatedUserEntitlement(
	userId: string,
	options?: { throwOnError?: boolean },
): Promise<AuthenticatedEntitlement> {
	const subscriptions = await getActiveSubscriptions(userId, {
		throwOnError: options?.throwOnError,
	});

	return subscriptions.some((subscription) => subscription.plan === "pro")
		? "pro"
		: "authenticated_unpaid";
}

export async function createProCheckoutUrl(args: {
	userId: string;
	successPath?: string;
	returnPath?: string;
}): Promise<string> {
	const productId = process.env.POLAR_PRODUCT_PRO_ID;
	if (!productId) {
		throw new Error("Pro product is not configured.");
	}

	const polarClient = getPolarClient();
	const userId = Number.parseInt(args.userId, 10);
	const customerEmail = Number.isFinite(userId)
		? await getDb()
				.select({ email: user.email })
				.from(user)
				.where(eq(user.id, userId))
				.get()
				.then((row) => row?.email)
		: undefined;
	const baseURL = resolveBaseURL();
	const checkout = await polarClient.checkouts.create({
		externalCustomerId: args.userId,
		products: [productId],
		...(customerEmail ? { customerEmail } : {}),
		successUrl: new URL(
			args.successPath ?? "/checkout/success?checkout_id={CHECKOUT_ID}",
			baseURL,
		).toString(),
		returnUrl: new URL(
			args.returnPath ?? "/account/access",
			baseURL,
		).toString(),
	});

	return checkout.url;
}
