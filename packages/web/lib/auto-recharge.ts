import { eq } from "drizzle-orm";
import { type Db, user } from "@/db";
import { getPolarClient } from "@/lib/auth";
import { baseUrl } from "@/lib/base-url";

export const MICRODOLLARS_PER_USD = 1_000_000;
export const DEFAULT_AUTO_RECHARGE_THRESHOLD = 1 * MICRODOLLARS_PER_USD;

export const AUTO_RECHARGE_AMOUNTS = [10, 20] as const;
export type AutoRechargeAmount = (typeof AUTO_RECHARGE_AMOUNTS)[number];

export type AutoRechargeSettings = {
	enabled: boolean;
	threshold: number;
	amount: AutoRechargeAmount;
};

const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 1_000 * MICRODOLLARS_PER_USD;

function normalizeAutoRechargeAmount(value: number): AutoRechargeAmount {
	return value === 20 ? 20 : 10;
}

function normalizeAutoRechargeThreshold(value: number): number {
	if (!Number.isFinite(value)) {
		return DEFAULT_AUTO_RECHARGE_THRESHOLD;
	}
	return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(value)));
}

function resolveCreditProductId(amount: AutoRechargeAmount): string | null {
	if (amount === 10) {
		return process.env.POLAR_PRODUCT_CREDIT_10_ID ?? null;
	}
	if (amount === 20) {
		return process.env.POLAR_PRODUCT_CREDIT_20_ID ?? null;
	}
	return null;
}

export async function getAutoRechargeSettings(
	db: Db,
	userId: number,
): Promise<AutoRechargeSettings> {
	const rows = await db
		.select({
			enabled: user.autoRechargeEnabled,
			threshold: user.autoRechargeThreshold,
			amount: user.autoRechargeAmount,
		})
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	const row = rows[0];
	if (!row) {
		return {
			enabled: false,
			threshold: DEFAULT_AUTO_RECHARGE_THRESHOLD,
			amount: 10,
		};
	}

	return {
		enabled: Boolean(row.enabled),
		threshold: normalizeAutoRechargeThreshold(row.threshold),
		amount: normalizeAutoRechargeAmount(row.amount),
	};
}

export async function updateAutoRechargeSettings(
	db: Db,
	userId: number,
	input: AutoRechargeSettings,
): Promise<AutoRechargeSettings | null> {
	const threshold = normalizeAutoRechargeThreshold(input.threshold);
	const amount = normalizeAutoRechargeAmount(input.amount);

	const updated = await db
		.update(user)
		.set({
			autoRechargeEnabled: input.enabled,
			autoRechargeThreshold: threshold,
			autoRechargeAmount: amount,
		})
		.where(eq(user.id, userId))
		.returning({ id: user.id });

	if (updated.length === 0) {
		return null;
	}

	return {
		enabled: input.enabled,
		threshold,
		amount,
	};
}

export async function createCreditCheckout(
	userId: number,
	amount: AutoRechargeAmount,
): Promise<{ id: string; url: string } | null> {
	const productId = resolveCreditProductId(amount);
	if (!productId) {
		return null;
	}

	const polarClient = getPolarClient();
	const checkout = await polarClient.checkouts.create({
		products: [productId],
		externalCustomerId: userId.toString(),
		successUrl: `${baseUrl}/settings/billing?checkout_id={CHECKOUT_ID}&credits=true`,
	});

	return {
		id: checkout.id,
		url: checkout.url,
	};
}
