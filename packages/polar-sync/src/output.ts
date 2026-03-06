import type { Config, Meter, Product, SyncAction } from "./types";

export function log(
	action: string,
	resource: string,
	name: string,
	details?: string,
): void {
	const prefix = details
		? `${action} ${resource}: ${name} (${details})`
		: `${action} ${resource}: ${name}`;
	console.log(`  ${prefix}`);
}

export function renderPlan(plan: SyncAction[]): void {
	console.log("\nPlanned changes:");
	for (const action of plan) {
		switch (action.kind) {
			case "CreateMeter":
				log("→", "Meter", action.config.name, "create");
				break;
			case "UpdateMeter":
				log("~", "Meter", action.config.name, action.changes.join(", "));
				break;
			case "CreateBenefit":
				log("→", "Benefit", action.config.description, "create");
				break;
			case "UpdateBenefit":
				log(
					"~",
					"Benefit",
					action.config.description,
					action.changes.join(", "),
				);
				break;
			case "CreateProduct":
				log("→", "Product", action.config.name, "create");
				break;
			case "UpdateProduct":
				log(
					"~",
					"Product",
					action.config.name,
					action.changes.length ? action.changes.join(", ") : "update",
				);
				break;
			case "UpdateProductPrices":
				log("~", "Product", action.config.name, `prices: ${action.reason}`);
				break;
			case "RecreateProduct":
				log(
					"!",
					"Product",
					action.config.name,
					`recreate required (${action.reason}), run with --recreate`,
				);
				break;
			case "ArchiveProduct":
				log(
					"-",
					"Product",
					action.configKey,
					`archive and recreate (${action.reason})`,
				);
				break;
			case "Noop":
				log("✓", "Resource", action.configKey, action.reason);
				break;
			default:
				throw new Error(`Unhandled action: ${JSON.stringify(action)}`);
		}
	}
}

export function printEnvironmentVariables(
	config: Config,
	products: Map<string, Product>,
	meters: Map<string, Meter>,
): void {
	console.log("\n  # Meters");
	for (const meterConfig of config.meters) {
		const meter = meters.get(meterConfig.key);
		if (!meter) continue;
		const envKey = `POLAR_${meterConfig.name.toUpperCase().replace(/\s+/g, "_")}_METER_ID`;
		console.log(`  ${envKey}="${meter.id}"`);
	}

	console.log("\n  # Products");
	for (const productConfig of config.products) {
		const product = products.get(productConfig.key);
		if (!product) continue;
		const envKey = `POLAR_PRODUCT_${productConfig.name
			.toUpperCase()
			.replace(/\s+/g, "_")
			.replace(/\$/g, "")}_ID`;
		console.log(`  ${envKey}="${product.id}"`);
	}

	console.log("\n  # One-Time Products");
	for (const productConfig of config.oneTimeProducts) {
		const product = products.get(productConfig.key);
		if (!product) continue;
		const envKey = `POLAR_PRODUCT_${productConfig.name
			.toUpperCase()
			.replace(/\s+/g, "_")
			.replace(/\$/g, "")}_ID`;
		console.log(`  ${envKey}="${product.id}"`);
	}
}
