import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound";
import { getPolarClient } from "@/lib/auth/auth";

export {
	generateCommitMessage,
	generateCommitMessageRefine,
	generateCommitMessageRefineStream,
	generateCommitMessageStream,
} from "./commit-message.server";
export { generatePrIntent } from "./pr-intent";
export { generatePrTitleBody } from "./pr-title-body";

type UserBillingInfo = {
	balance: number;
	meterId: string;
	plan: "pro";
};

function getPaidProductIds(): string[] {
	return [
		process.env.POLAR_PRODUCT_PRO_ID,
		process.env.POLAR_PRODUCT_FOUNDER_ID,
	].filter((id): id is string => id != null && id.length > 0);
}

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

	const externalCustomerIdString = externalCustomerId.toString();

	try {
		const polarClient = getPolarClient();
		const customerState = await polarClient.customers.getStateExternal({
			externalId: externalCustomerIdString,
		});

		const paidProductIds = getPaidProductIds();
		const isPro =
			paidProductIds.length > 0 &&
			customerState.activeSubscriptions.some((sub: { productId: string }) =>
				paidProductIds.includes(sub.productId),
			);

		if (!isPro) {
			return null;
		}

		const meterResponse = await polarClient.customerMeters.list({
			externalCustomerId: externalCustomerIdString,
			meterId: usageCostMeterId,
			limit: 1,
		});
		const meters = meterResponse.result.items;
		if (meters.length === 0) {
			return null;
		}

		const meter = meters[0];

		return {
			balance: meter.balance,
			meterId: meter.meterId,
			plan: "pro",
		};
	} catch (error) {
		if (error instanceof ResourceNotFound) {
			return null;
		}
		console.error("[polar] Failed to get user billing info:", error);
		if (options?.throwOnError) {
			throw error;
		}
		return null;
	}
}
