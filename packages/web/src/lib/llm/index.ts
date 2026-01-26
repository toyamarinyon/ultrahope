import {
	translate as coreTranslate,
	type LLMResponse,
	type Target,
} from "@ultrahope/core";
import { after } from "next/server";
import { polarClient } from "@/lib/auth";

const MICRODOLLARS_PER_USD = 1_000_000;

type TranslateOptions = {
	externalCustomerId?: string;
};

type UserBillingInfo = {
	balance: number;
	meterId: string;
	plan: UserPlan;
};

export type UserPlan = "free" | "pro";

export class InsufficientBalanceError extends Error {
	constructor(
		public balance: number,
		public meterId: string,
		public plan: UserPlan = "free",
	) {
		super(`Insufficient balance: ${balance} remaining`);
		this.name = "InsufficientBalanceError";
	}
}

async function getUserBillingInfo(
	externalCustomerId: string,
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

	try {
		const [meterResponse, customerState] = await Promise.all([
			polarClient.customerMeters.list({
				externalCustomerId,
				meterId: usageCostMeterId,
				limit: 1,
			}),
			polarClient.customers.getStateExternal({
				externalId: externalCustomerId,
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

async function recordUsage(
	externalCustomerId: string | undefined,
	response: LLMResponse,
): Promise<void> {
	if (!externalCustomerId) {
		return;
	}
	if (!process.env.POLAR_ACCESS_TOKEN) {
		console.warn("[polar] POLAR_ACCESS_TOKEN not set, skipping usage ingest");
		return;
	}
	if (response.cost === undefined || response.cost <= 0) {
		return;
	}

	const costInMicrodollars = Math.round(response.cost * MICRODOLLARS_PER_USD);

	try {
		await polarClient.events.ingest({
			events: [
				{
					name: "usage",
					externalCustomerId,
					metadata: {
						cost: costInMicrodollars,
						model: response.model,
						...(response.generationId && {
							generationId: response.generationId,
						}),
					},
				},
			],
		});
	} catch (error) {
		console.error("[polar] Failed to ingest usage:", error);
	}
}

export async function translate(
	input: string,
	target: Target,
	options: TranslateOptions = {},
): Promise<string> {
	if (options.externalCustomerId) {
		const billingInfo = await getUserBillingInfo(options.externalCustomerId);
		if (billingInfo && billingInfo.balance <= 0) {
			throw new InsufficientBalanceError(
				billingInfo.balance,
				billingInfo.meterId,
				billingInfo.plan,
			);
		}
	}

	const response = await coreTranslate(input, target);

	after(async () => {
		await recordUsage(options.externalCustomerId, response);
	});

	return response.content;
}
