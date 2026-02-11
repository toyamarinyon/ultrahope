import { getPolarClient } from "@/lib/auth";

export type UserPlan = "free" | "pro";

export type ActiveSubscription = {
	id: string;
	productId: string;
	plan: UserPlan;
};

export type BillingHistoryItem = {
	id: string;
	createdAt: Date;
	totalAmount: number;
	currency: string;
	status: string;
	paid: boolean;
	invoiceNumber: string;
	description: string;
};

function resolvePlanFromProductId(productId: string): UserPlan | null {
	const freeProductId = process.env.POLAR_PRODUCT_FREE_ID;
	const proProductId = process.env.POLAR_PRODUCT_PRO_ID;
	const founderProductId = process.env.POLAR_PRODUCT_FOUNDER_ID;

	if (freeProductId && productId === freeProductId) {
		return "free";
	}
	if (
		(proProductId && productId === proProductId) ||
		(founderProductId && productId === founderProductId)
	) {
		return "pro";
	}
	return null;
}

export async function getActiveSubscriptions(
	externalCustomerId: string,
): Promise<ActiveSubscription[]> {
	if (!process.env.POLAR_ACCESS_TOKEN) {
		return [];
	}

	try {
		const polarClient = getPolarClient();
		const customerState = await polarClient.customers.getStateExternal({
			externalId: externalCustomerId,
		});

		return customerState.activeSubscriptions
			.map((subscription) => {
				const plan = resolvePlanFromProductId(subscription.productId);
				if (!plan) {
					return null;
				}
				return {
					id: subscription.id,
					productId: subscription.productId,
					plan,
				} satisfies ActiveSubscription;
			})
			.filter((subscription): subscription is ActiveSubscription => {
				return subscription !== null;
			});
	} catch (error) {
		console.error("[polar] Failed to load active subscriptions:", error);
		return [];
	}
}

export function resolveCurrentPlan(
	subscriptions: ActiveSubscription[],
): UserPlan {
	return subscriptions.some((subscription) => subscription.plan === "pro")
		? "pro"
		: "free";
}

export async function getBillingHistory(
	externalCustomerId: string,
	limit = 10,
): Promise<BillingHistoryItem[]> {
	if (!process.env.POLAR_ACCESS_TOKEN) {
		return [];
	}

	try {
		const polarClient = getPolarClient();
		const firstPage = await polarClient.orders.list({
			externalCustomerId,
			limit,
			sorting: ["-created_at"],
		});

		return firstPage.result.items.map((order) => ({
			id: order.id,
			createdAt: order.createdAt,
			totalAmount: order.totalAmount,
			currency: order.currency,
			status: order.status,
			paid: order.paid,
			invoiceNumber: order.invoiceNumber,
			description: order.description,
		}));
	} catch (error) {
		console.error("[polar] Failed to load billing history:", error);
		return [];
	}
}
