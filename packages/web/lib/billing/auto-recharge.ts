import { getPolarClient } from "@/lib/auth/auth";
import { baseUrl } from "@/lib/util/base-url";

export const MICRODOLLARS_PER_USD = 1_000_000;

export const AUTO_RECHARGE_AMOUNTS = [10, 20] as const;
export type AutoRechargeAmount = (typeof AUTO_RECHARGE_AMOUNTS)[number];

function resolveCreditProductId(amount: AutoRechargeAmount): string | null {
	if (amount === 10) {
		return process.env.POLAR_PRODUCT_CREDIT_10_ID ?? null;
	}
	if (amount === 20) {
		return process.env.POLAR_PRODUCT_CREDIT_20_ID ?? null;
	}
	return null;
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
