import {
	translate as coreTranslate,
	translateMulti as coreTranslateMulti,
	type LLMMultiResponse,
	type LLMResponse,
	type Target,
} from "@ultrahope/core";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { polarClient } from "@/lib/auth";

const MICRODOLLARS_PER_USD = 1_000_000;

type TranslateOptions = {
	externalCustomerId?: string;
};

type UserBillingInfo = {
	balance: number;
	meterId: string;
	plan: UserPlan;
	allowOverage: boolean;
};

export type UserPlan = "free" | "pro";

export class InsufficientBalanceError extends Error {
	constructor(
		public balance: number,
		public meterId: string,
		public plan: UserPlan = "free",
		public allowOverage: boolean = false,
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
		const [meterResponse, customerState, userRecords] = await Promise.all([
			polarClient.customerMeters.list({
				externalCustomerId,
				meterId: usageCostMeterId,
				limit: 1,
			}),
			polarClient.customers.getStateExternal({
				externalId: externalCustomerId,
			}),
			db
				.select({ allowOverage: schema.user.allowOverage })
				.from(schema.user)
				.where(eq(schema.user.id, externalCustomerId))
				.limit(1),
		]);
		const userRecord = userRecords[0];

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
			allowOverage: userRecord?.allowOverage ?? false,
		};
	} catch (error) {
		console.error("[polar] Failed to get user billing info:", error);
		return null;
	}
}

async function recordUsage(
	externalCustomerId: string | undefined,
	response: LLMResponse | LLMMultiResponse,
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

	const generationId =
		"generationId" in response
			? response.generationId
			: "generationIds" in response
				? response.generationIds?.join(",")
				: undefined;

	try {
		await polarClient.events.ingest({
			events: [
				{
					name: "usage",
					externalCustomerId,
					metadata: {
						cost: costInMicrodollars,
						model: response.model,
						...(generationId && { generationId }),
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
		if (billingInfo && billingInfo.balance <= 0 && !billingInfo.allowOverage) {
			throw new InsufficientBalanceError(
				billingInfo.balance,
				billingInfo.meterId,
				billingInfo.plan,
				billingInfo.allowOverage,
			);
		}
	}

	const response = await coreTranslate(input, target);

	after(async () => {
		await recordUsage(options.externalCustomerId, response);
	});

	return response.content;
}

export async function translateMulti(
	input: string,
	target: Target,
	n: number,
	options: TranslateOptions = {},
): Promise<string[]> {
	if (options.externalCustomerId) {
		const billingInfo = await getUserBillingInfo(options.externalCustomerId);
		if (billingInfo && billingInfo.balance <= 0 && !billingInfo.allowOverage) {
			throw new InsufficientBalanceError(
				billingInfo.balance,
				billingInfo.meterId,
				billingInfo.plan,
				billingInfo.allowOverage,
			);
		}
	}

	const response = await coreTranslateMulti(input, target, n);

	after(async () => {
		await recordUsage(options.externalCustomerId, response);
	});

	return response.contents;
}
