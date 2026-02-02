import { polarClient } from "@/lib/auth";

export { DailyLimitExceededError } from "@/lib/daily-limit";

export {
	generateCommitMessage,
	generateCommitMessageStream,
} from "./commit-message";
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
	const externalCustomerIdString = externalCustomerId.toString();

	try {
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
		const isPro =
			proProductId != null &&
			customerState.activeSubscriptions.some(
				(sub: { productId: string }) => sub.productId === proProductId,
			);

		return {
			balance: meter.balance,
			meterId: meter.meterId,
			plan: isPro ? "pro" : "free",
		};
	} catch (error) {
		console.error("[polar] Failed to get user billing info:", error);
		return null;
	}
}
