import { getPolarClient } from "@/lib/auth/auth";

export { DailyLimitExceededError } from "@/lib/util/daily-limit";

export {
	generateCommitMessage,
	generateCommitMessageStream,
} from "./commit-message.server";
export { generatePrIntent } from "./pr-intent";
export { generatePrTitleBody } from "./pr-title-body";
export type { LLMResponse } from "./types";

type UserBillingInfo = {
	balance: number;
	meterId: string;
	plan: UserPlan;
};

type UserPlan = "free" | "pro";

export async function getUserBillingInfo(
	externalCustomerId: number,
	options?: { throwOnError?: boolean },
): Promise<UserBillingInfo | null> {
	if (!process.env.POLAR_ACCESS_TOKEN) {
		return null;
	}

	const usageCostMeterId = process.env.POLAR_USAGE_COST_METER_ID;
	if (!usageCostMeterId) {
		console.warn(
			"[polar] POLAR_USAGE_COST_METER_ID not set, skipping balance check",
		);
		return null;
	}

	const proProductId = process.env.POLAR_PRODUCT_PRO_ID;
	/**
	 * Founder Plan: unlisted developer-only plan. Free but grants $999/month in credits.
	 * Grouped into {@link paidProductIds} so it is treated the same as Pro.
	 */
	const founderProductId = process.env.POLAR_PRODUCT_FOUNDER_ID;
	const externalCustomerIdString = externalCustomerId.toString();

	try {
		const polarClient = getPolarClient();
		const [meterResponse, customerState] = await Promise.all([
			polarClient.customerMeters.list({
				externalCustomerId: externalCustomerIdString,
				meterId: usageCostMeterId,
				limit: 1,
			}),
			polarClient.customers.getStateExternal({
				externalId: externalCustomerIdString,
			}),
		]);

		const meters = meterResponse.result.items;
		if (meters.length === 0) {
			return null;
		}

		const meter = meters[0];
		// Treat both Pro and Founder subscriptions as the "pro" plan
		const paidProductIds = [proProductId, founderProductId].filter(
			(id): id is string => id != null,
		);
		const isPro =
			paidProductIds.length > 0 &&
			customerState.activeSubscriptions.some((sub: { productId: string }) =>
				paidProductIds.includes(sub.productId),
			);

		return {
			balance: meter.balance,
			meterId: meter.meterId,
			plan: isPro ? "pro" : "free",
		};
	} catch (error) {
		console.error("[polar] Failed to get user billing info:", error);
		if (options?.throwOnError) {
			throw error;
		}
		return null;
	}
}
