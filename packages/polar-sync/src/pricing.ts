import type {
	ExistingProductPriceLike,
	MeterLookup,
	PriceSyncDecision,
	ProductCreatePrice,
	ProductPriceConfig,
} from "./types";

function assertUnreachable(value: never): never {
	throw new Error(`Unsupported price type: ${String(value)}`);
}

function formatPrice(price: ProductPriceConfig): string {
	if (price.amountType === "free") return "free";
	if (price.amountType === "fixed")
		return `$${((price.priceAmount ?? 0) / 100).toFixed(2)}`;

	return `metered:${price.meterKey}@$${price.priceAmount}`;
}

function formatConfigCurrency(price: ProductPriceConfig): string {
	return price.priceCurrency ?? "usd";
}

function formatExistingFixedPrice(price: ExistingProductPriceLike): string {
	return `$${((price.priceAmount ?? 0) / 100).toFixed(2)}`;
}

export function classifyPriceSync(
	existingPrices: ExistingProductPriceLike[],
	configPrices: ProductPriceConfig[],
	meters: MeterLookup,
): PriceSyncDecision {
	const updateDetails: string[] = [];

	if (existingPrices.length !== configPrices.length) {
		return {
			kind: "recreate",
			details: `price count: ${existingPrices.length} vs ${configPrices.length}`,
		};
	}

	for (let i = 0; i < configPrices.length; i++) {
		const cfg = configPrices[i];
		const ext = existingPrices[i];

		switch (cfg.amountType) {
			case "free":
				if (ext.amountType !== "free") {
					return { kind: "recreate", details: `price[${i}]: expected free` };
				}
				break;
			case "fixed": {
				if (ext.amountType !== "fixed") {
					return { kind: "recreate", details: `price[${i}]: expected fixed` };
				}
				const configCurrency = formatConfigCurrency(cfg);
				if (ext.priceCurrency !== configCurrency) {
					return {
						kind: "recreate",
						details: `price[${i}]: currency ${ext.priceCurrency ?? "unknown"} vs ${configCurrency}`,
					};
				}
				if (ext.priceAmount !== cfg.priceAmount) {
					updateDetails.push(
						`price[${i}]: ${formatExistingFixedPrice(ext)} -> ${formatPrice(cfg)}`,
					);
				}
				break;
			}
			case "metered_unit": {
				if (ext.amountType !== "metered_unit") {
					return {
						kind: "recreate",
						details: `price[${i}]: expected metered_unit`,
					};
				}
				const meter = cfg.meterKey ? meters.get(cfg.meterKey) : null;
				if (meter && ext.meterId !== meter.id) {
					return { kind: "recreate", details: `price[${i}]: meter mismatch` };
				}
				const configCurrency = formatConfigCurrency(cfg);
				if (ext.priceCurrency !== configCurrency) {
					return {
						kind: "recreate",
						details: `price[${i}]: currency ${ext.priceCurrency ?? "unknown"} vs ${configCurrency}`,
					};
				}
				if (ext.unitAmount !== String(cfg.priceAmount)) {
					return {
						kind: "recreate",
						details: `price[${i}]: unit $${ext.unitAmount} vs $${cfg.priceAmount}`,
					};
				}
				break;
			}
		}
	}

	if (updateDetails.length > 0) {
		return { kind: "update", details: updateDetails.join(", ") };
	}

	return { kind: "match", details: "" };
}

export function buildProductPrices(
	prices: ProductPriceConfig[],
	meters: MeterLookup,
): ProductCreatePrice[] {
	return prices.map((price) => {
		switch (price.amountType) {
			case "free":
				return { amountType: "free" };
			case "fixed":
				return {
					amountType: "fixed",
					priceAmount: price.priceAmount ?? 0,
					priceCurrency: formatConfigCurrency(price),
				};
			case "metered_unit": {
				const meter = price.meterKey ? meters.get(price.meterKey) : null;
				if (!meter) {
					throw new Error(
						`Meter "${price.meterKey}" not found for metered price`,
					);
				}
				return {
					amountType: "metered_unit",
					unitAmount: price.priceAmount ?? 0,
					priceCurrency: formatConfigCurrency(price),
					meterId: meter.id,
				};
			}
			default:
				return assertUnreachable(price.amountType);
		}
	});
}
