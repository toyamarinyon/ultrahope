/**
 * Idempotent Polar.sh configuration sync script.
 *
 * This script manages Meters, Benefits, and Products in Polar.sh.
 * It ensures resources exist with the correct configuration, creating or updating as needed.
 *
 * Usage:
 *   # Production (default)
 *   mise -E production exec -- pnpm tsx scripts/polar-sync.ts
 *
 *   # Sandbox
 *   mise -E sandbox exec -- pnpm tsx scripts/polar-sync.ts --server sandbox
 *
 *   # Dry-run (show what would be done without prompting)
 *   pnpm tsx scripts/polar-sync.ts --dry-run
 *
 *   # Skip confirmation prompt
 *   pnpm tsx scripts/polar-sync.ts --yes
 *
 * Flags:
 *   --server <production|sandbox>  Target server (default: production)
 *   --recreate                     Archive and recreate products with price mismatches
 *
 * Environment:
 *   POLAR_SYNC_ACCESS_TOKEN - Organization Access Token with required scopes
 *
 * Required OAT scopes:
 *   - meters:read, meters:write
 *   - benefits:read, benefits:write
 *   - products:read, products:write
 */

import { Polar } from "@polar-sh/sdk";

type Meter = Awaited<ReturnType<Polar["meters"]["get"]>>;
type Benefit = Awaited<ReturnType<Polar["benefits"]["get"]>>;
type Product = Awaited<ReturnType<Polar["products"]["get"]>>;

// =============================================================================
// Configuration
// =============================================================================

interface MeterConfig {
	name: string;
	filter: {
		conjunction: "and" | "or";
		clauses: Array<{
			property: string;
			operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
			value: string | number | boolean;
		}>;
	};
	aggregation: {
		func: "sum" | "count" | "avg" | "min" | "max";
		property?: string;
	};
}

interface BenefitConfig {
	key: string;
	type: "meter_credit";
	description: string;
	meterName: string;
	units: number;
	rollover: boolean;
}

interface ProductPriceConfig {
	amountType: "free" | "fixed" | "custom" | "metered_unit";
	priceAmount?: number;
	priceCurrency?: string;
	meterName?: string; // for metered_unit prices
}

interface ProductConfig {
	name: string;
	description: string;
	recurringInterval: "month" | "year";
	prices: ProductPriceConfig[];
	benefitKeys: string[];
}

interface OneTimeProductConfig {
	name: string;
	description: string;
	prices: ProductPriceConfig[];
	benefitKeys: string[];
}

interface Config {
	meters: MeterConfig[];
	benefits: BenefitConfig[];
	products: ProductConfig[];
	oneTimeProducts: OneTimeProductConfig[];
}

// USD-based billing with microdollars (1 USD = 1,000,000 units)
// This avoids floating-point precision issues while supporting sub-cent costs
const MICRODOLLARS_PER_USD = 1_000_000;

const CONFIG: Config = {
	meters: [
		{
			name: "Usage Cost",
			filter: {
				conjunction: "and",
				clauses: [
					{
						property: "name",
						operator: "eq",
						value: "usage",
					},
				],
			},
			aggregation: {
				func: "sum",
				property: "cost", // in microdollars
			},
		},
	],

	benefits: [
		{
			key: "pro_credits",
			type: "meter_credit",
			description: "$5 included credit",
			meterName: "Usage Cost",
			units: 5 * MICRODOLLARS_PER_USD, // $5.00
			rollover: false,
		},
		{
			key: "founder_credits",
			type: "meter_credit",
			description: "Founder unlimited credit",
			meterName: "Usage Cost",
			units: 999 * MICRODOLLARS_PER_USD, // $999.00
			rollover: false,
		},
		{
			key: "credit_10",
			type: "meter_credit",
			description: "$10 credit top-up",
			meterName: "Usage Cost",
			units: 10 * MICRODOLLARS_PER_USD, // $10.00
			rollover: true, // one-time credits should roll over
		},
		{
			key: "credit_20",
			type: "meter_credit",
			description: "$20 credit top-up",
			meterName: "Usage Cost",
			units: 20 * MICRODOLLARS_PER_USD, // $20.00
			rollover: true, // one-time credits should roll over
		},
	],

	products: [
		{
			name: "Free",
			description: "Free plan with 5 requests/day",
			recurringInterval: "month",
			prices: [{ amountType: "free" }],
			benefitKeys: [],
		},
		{
			name: "Pro",
			description: "Pro plan with $5 included credit",
			recurringInterval: "month",
			prices: [
				{
					amountType: "fixed",
					priceAmount: 1000, // $10.00 in cents
					priceCurrency: "usd",
				},
			],
			benefitKeys: ["pro_credits"],
		},
		{
			name: "Founder",
			description: "Internal founder plan",
			recurringInterval: "month",
			prices: [{ amountType: "free" }],
			benefitKeys: ["founder_credits"],
		},
	],

	// One-time credit top-up products (Pro users only)
	oneTimeProducts: [
		{
			name: "Credit $10",
			description: "Add $10 usage credit to your account",
			prices: [
				{
					amountType: "fixed",
					priceAmount: 1000, // $10.00 in cents
					priceCurrency: "usd",
				},
			],
			benefitKeys: ["credit_10"],
		},
		{
			name: "Credit $20",
			description: "Add $20 usage credit to your account",
			prices: [
				{
					amountType: "fixed",
					priceAmount: 2000, // $20.00 in cents
					priceCurrency: "usd",
				},
			],
			benefitKeys: ["credit_20"],
		},
	],
};

// =============================================================================
// Types
// =============================================================================

interface SyncContext {
	polar: Polar;
	dryRun: boolean;
	recreate: boolean;
	meters: Map<string, Meter>;
	benefits: Map<string, Benefit>;
	products: Map<string, Product>;
}

// =============================================================================
// Helpers
// =============================================================================

function log(action: string, resource: string, name: string, details?: string) {
	const prefix = details
		? `${action} ${resource}: ${name} (${details})`
		: `${action} ${resource}: ${name}`;
	console.log(`  ${prefix}`);
}

function _formatPrice(price: ProductPriceConfig): string {
	if (price.amountType === "free") return "free";
	if (price.amountType === "fixed")
		return `$${((price.priceAmount ?? 0) / 100).toFixed(2)}`;
	if (price.amountType === "metered_unit")
		return `metered:${price.meterName}@$${price.priceAmount}`;
	return price.amountType;
}

function comparePrices(
	existing: Product,
	config: ProductConfig,
	meters: Map<string, Meter>,
): { match: boolean; details: string } {
	const existingPrices = existing.prices;
	const configPrices = config.prices;

	if (existingPrices.length !== configPrices.length) {
		return {
			match: false,
			details: `price count: ${existingPrices.length} vs ${configPrices.length}`,
		};
	}

	for (let i = 0; i < configPrices.length; i++) {
		const cfg = configPrices[i];
		const ext = existingPrices[i];

		if (cfg.amountType === "free") {
			if (ext.amountType !== "free") {
				return { match: false, details: `price[${i}]: expected free` };
			}
		} else if (cfg.amountType === "fixed") {
			if (ext.amountType !== "fixed") {
				return { match: false, details: `price[${i}]: expected fixed` };
			}
			if (ext.priceAmount !== cfg.priceAmount) {
				return {
					match: false,
					details: `price[${i}]: $${(ext.priceAmount / 100).toFixed(2)} vs $${((cfg.priceAmount ?? 0) / 100).toFixed(2)}`,
				};
			}
		} else if (cfg.amountType === "metered_unit") {
			if (ext.amountType !== "metered_unit") {
				return { match: false, details: `price[${i}]: expected metered_unit` };
			}
			const meter = meters.get(cfg.meterName ?? "");
			if (meter && ext.meterId !== meter.id) {
				return { match: false, details: `price[${i}]: meter mismatch` };
			}
			if (ext.unitAmount !== String(cfg.priceAmount)) {
				return {
					match: false,
					details: `price[${i}]: unit $${ext.unitAmount} vs $${cfg.priceAmount}`,
				};
			}
		}
	}

	return { match: true, details: "" };
}

async function fetchAllMeters(polar: Polar): Promise<Map<string, Meter>> {
	const meters = new Map<string, Meter>();
	const response = await polar.meters.list({});
	for await (const page of response) {
		for (const meter of page.result.items) {
			meters.set(meter.name, meter);
		}
	}
	return meters;
}

async function fetchAllBenefits(polar: Polar): Promise<Map<string, Benefit>> {
	const benefits = new Map<string, Benefit>();
	const response = await polar.benefits.list({});
	for await (const page of response) {
		for (const benefit of page.result.items) {
			benefits.set(benefit.description, benefit);
		}
	}
	return benefits;
}

async function fetchAllProducts(polar: Polar): Promise<Map<string, Product>> {
	const products = new Map<string, Product>();
	const response = await polar.products.list({ isArchived: false });
	for await (const page of response) {
		for (const product of page.result.items) {
			products.set(product.name, product);
		}
	}
	return products;
}

// =============================================================================
// Sync Functions
// =============================================================================

async function syncMeters(ctx: SyncContext): Promise<void> {
	console.log("\n[Meters]");

	for (const meterConfig of CONFIG.meters) {
		const existing = ctx.meters.get(meterConfig.name);

		if (existing) {
			log("✓", "Meter", meterConfig.name, `id=${existing.id}`);
		} else {
			if (ctx.dryRun) {
				log("→", "Meter", meterConfig.name, "would create");
			} else {
				const aggregation =
					meterConfig.aggregation.func === "count"
						? { func: "count" as const }
						: {
								func: meterConfig.aggregation.func as
									| "sum"
									| "avg"
									| "min"
									| "max",
								property: meterConfig.aggregation.property ?? "",
							};

				const created = await ctx.polar.meters.create({
					name: meterConfig.name,
					filter: meterConfig.filter,
					aggregation,
				});
				ctx.meters.set(created.name, created);
				log("+", "Meter", meterConfig.name, `created id=${created.id}`);
			}
		}
	}
}

async function syncBenefits(ctx: SyncContext): Promise<void> {
	console.log("\n[Benefits]");

	for (const benefitConfig of CONFIG.benefits) {
		const existing = ctx.benefits.get(benefitConfig.description);
		const meter = ctx.meters.get(benefitConfig.meterName);

		if (!meter) {
			if (ctx.dryRun) {
				log(
					"!",
					"Benefit",
					benefitConfig.description,
					`meter "${benefitConfig.meterName}" not found (would be created)`,
				);
			} else {
				throw new Error(
					`Meter "${benefitConfig.meterName}" not found for benefit "${benefitConfig.description}"`,
				);
			}
			continue;
		}

		if (existing) {
			if (existing.type === "meter_credit") {
				const props = existing.properties;
				const needsUpdate =
					props.units !== benefitConfig.units ||
					props.rollover !== benefitConfig.rollover ||
					props.meterId !== meter.id;

				if (needsUpdate) {
					if (ctx.dryRun) {
						log("→", "Benefit", benefitConfig.description, "would update");
					} else {
						const updated = await ctx.polar.benefits.update({
							id: existing.id,
							requestBody: {
								type: "meter_credit",
								description: benefitConfig.description,
								properties: {
									units: benefitConfig.units,
									rollover: benefitConfig.rollover,
									meterId: meter.id,
								},
							},
						});
						ctx.benefits.set(updated.description, updated);
						log(
							"~",
							"Benefit",
							benefitConfig.description,
							`updated id=${existing.id}`,
						);
					}
				} else {
					log("✓", "Benefit", benefitConfig.description, `id=${existing.id}`);
				}
			} else {
				log(
					"!",
					"Benefit",
					benefitConfig.description,
					`type mismatch: expected meter_credit, got ${existing.type}`,
				);
			}
		} else {
			if (ctx.dryRun) {
				log("→", "Benefit", benefitConfig.description, "would create");
			} else {
				const created = await ctx.polar.benefits.create({
					type: "meter_credit",
					description: benefitConfig.description,
					properties: {
						units: benefitConfig.units,
						rollover: benefitConfig.rollover,
						meterId: meter.id,
					},
				});
				ctx.benefits.set(created.description, created);
				log(
					"+",
					"Benefit",
					benefitConfig.description,
					`created id=${created.id}`,
				);
			}
		}
	}
}

async function syncProducts(ctx: SyncContext): Promise<void> {
	console.log("\n[Products]");

	for (const productConfig of CONFIG.products) {
		const existing = ctx.products.get(productConfig.name);

		const benefitIds: string[] = [];
		for (const benefitKey of productConfig.benefitKeys) {
			const benefitConf = CONFIG.benefits.find((b) => b.key === benefitKey);
			if (!benefitConf) {
				throw new Error(`Benefit key "${benefitKey}" not found in CONFIG`);
			}
			const benefit = ctx.benefits.get(benefitConf.description);
			if (!benefit) {
				if (ctx.dryRun) {
					log(
						"!",
						"Product",
						productConfig.name,
						`benefit "${benefitConf.description}" not found (would be created)`,
					);
					continue;
				}
				throw new Error(
					`Benefit "${benefitConf.description}" not found for product "${productConfig.name}"`,
				);
			}
			benefitIds.push(benefit.id);
		}

		if (existing) {
			const existingBenefitIds = existing.benefits
				.map((b: { id: string }) => b.id)
				.sort();
			const targetBenefitIds = [...benefitIds].sort();
			const benefitsMatch =
				existingBenefitIds.length === targetBenefitIds.length &&
				existingBenefitIds.every(
					(id: string, i: number) => id === targetBenefitIds[i],
				);

			const descriptionMatch =
				existing.description === productConfig.description;

			const priceCheck = comparePrices(existing, productConfig, ctx.meters);

			if (!priceCheck.match) {
				if (ctx.recreate) {
					if (ctx.dryRun) {
						log(
							"→",
							"Product",
							productConfig.name,
							`would archive and recreate (${priceCheck.details})`,
						);
					} else {
						await ctx.polar.products.update({
							id: existing.id,
							productUpdate: { isArchived: true },
						});
						log(
							"-",
							"Product",
							productConfig.name,
							`archived id=${existing.id}`,
						);
						// Fall through to create new product below
						ctx.products.delete(productConfig.name);
					}
				} else {
					log(
						"!",
						"Product",
						productConfig.name,
						`price mismatch: ${priceCheck.details} (use --recreate to fix)`,
					);
					continue;
				}
			} else if (!benefitsMatch || !descriptionMatch) {
				if (ctx.dryRun) {
					log("→", "Product", productConfig.name, "would update");
				} else {
					await ctx.polar.products.update({
						id: existing.id,
						productUpdate: {
							name: productConfig.name,
							description: productConfig.description,
						},
					});
					await ctx.polar.products.updateBenefits({
						id: existing.id,
						productBenefitsUpdate: {
							benefits: benefitIds,
						},
					});
					log("~", "Product", productConfig.name, `updated id=${existing.id}`);
				}
				continue;
			} else {
				log("✓", "Product", productConfig.name, `id=${existing.id}`);
				continue;
			}
		}

		if (!ctx.products.has(productConfig.name)) {
			if (ctx.dryRun) {
				log("→", "Product", productConfig.name, "would create");
			} else {
				const prices = productConfig.prices.map((p) => {
					if (p.amountType === "free") {
						return { amountType: "free" as const };
					}
					if (p.amountType === "fixed") {
						return {
							amountType: "fixed" as const,
							priceAmount: p.priceAmount ?? 0,
							priceCurrency: p.priceCurrency as "usd",
						};
					}
					if (p.amountType === "metered_unit") {
						const meter = ctx.meters.get(p.meterName ?? "");
						if (!meter) {
							throw new Error(
								`Meter "${p.meterName}" not found for metered price`,
							);
						}
						return {
							amountType: "metered_unit" as const,
							unitAmount: p.priceAmount ?? 0,
							priceCurrency: p.priceCurrency as "usd",
							meterId: meter.id,
						};
					}
					throw new Error(`Unsupported price type: ${p.amountType}`);
				});

				const created = await ctx.polar.products.create({
					name: productConfig.name,
					description: productConfig.description,
					recurringInterval: productConfig.recurringInterval,
					prices,
				});
				await ctx.polar.products.updateBenefits({
					id: created.id,
					productBenefitsUpdate: {
						benefits: benefitIds,
					},
				});
				ctx.products.set(created.name, created);
				log("+", "Product", productConfig.name, `created id=${created.id}`);
			}
		}
	}
}

async function syncOneTimeProducts(ctx: SyncContext): Promise<void> {
	console.log("\n[One-Time Products]");

	for (const productConfig of CONFIG.oneTimeProducts) {
		const existing = ctx.products.get(productConfig.name);

		const benefitIds: string[] = [];
		for (const benefitKey of productConfig.benefitKeys) {
			const benefitConf = CONFIG.benefits.find((b) => b.key === benefitKey);
			if (!benefitConf) {
				throw new Error(`Benefit key "${benefitKey}" not found in CONFIG`);
			}
			const benefit = ctx.benefits.get(benefitConf.description);
			if (!benefit) {
				if (ctx.dryRun) {
					log(
						"!",
						"Product",
						productConfig.name,
						`benefit "${benefitConf.description}" not found (would be created)`,
					);
					continue;
				}
				throw new Error(
					`Benefit "${benefitConf.description}" not found for product "${productConfig.name}"`,
				);
			}
			benefitIds.push(benefit.id);
		}

		if (existing) {
			const existingBenefitIds = existing.benefits
				.map((b: { id: string }) => b.id)
				.sort();
			const targetBenefitIds = [...benefitIds].sort();
			const benefitsMatch =
				existingBenefitIds.length === targetBenefitIds.length &&
				existingBenefitIds.every(
					(id: string, i: number) => id === targetBenefitIds[i],
				);

			const descriptionMatch =
				existing.description === productConfig.description;

			if (!benefitsMatch || !descriptionMatch) {
				if (ctx.dryRun) {
					log("→", "Product", productConfig.name, "would update");
				} else {
					await ctx.polar.products.update({
						id: existing.id,
						productUpdate: {
							name: productConfig.name,
							description: productConfig.description,
						},
					});
					await ctx.polar.products.updateBenefits({
						id: existing.id,
						productBenefitsUpdate: {
							benefits: benefitIds,
						},
					});
					log("~", "Product", productConfig.name, `updated id=${existing.id}`);
				}
				continue;
			} else {
				log("✓", "Product", productConfig.name, `id=${existing.id}`);
				continue;
			}
		}

		if (!ctx.products.has(productConfig.name)) {
			if (ctx.dryRun) {
				log("→", "Product", productConfig.name, "would create");
			} else {
				const prices = productConfig.prices.map((p) => {
					if (p.amountType === "fixed") {
						return {
							amountType: "fixed" as const,
							priceAmount: p.priceAmount ?? 0,
							priceCurrency: p.priceCurrency as "usd",
						};
					}
					throw new Error(
						`Unsupported price type for one-time product: ${p.amountType}`,
					);
				});

				const created = await ctx.polar.products.create({
					name: productConfig.name,
					description: productConfig.description,
					prices,
				});
				await ctx.polar.products.updateBenefits({
					id: created.id,
					productBenefitsUpdate: {
						benefits: benefitIds,
					},
				});
				ctx.products.set(created.name, created);
				log("+", "Product", productConfig.name, `created id=${created.id}`);
			}
		}
	}
}

// =============================================================================
// Main
// =============================================================================

async function prompt(message: string): Promise<boolean> {
	process.stdout.write(`${message} [y/N] `);
	const response = await new Promise<string>((resolve) => {
		const stdin = process.stdin;
		stdin.setEncoding("utf8");
		stdin.once("data", (data) => {
			resolve(data.toString().trim().toLowerCase());
		});
	});
	return response === "y" || response === "yes";
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const autoConfirm = args.includes("--yes") || args.includes("-y");
	const recreate = args.includes("--recreate");

	const serverIndex = args.indexOf("--server");
	const server: "production" | "sandbox" =
		serverIndex !== -1 && args[serverIndex + 1] === "sandbox"
			? "sandbox"
			: "production";

	const flags = [dryRun && "dry-run", recreate && "recreate"]
		.filter(Boolean)
		.join(", ");
	console.log(`Polar Sync - ${server}${flags ? ` (${flags})` : ""}`);
	console.log("=".repeat(50));

	const accessToken = process.env.POLAR_SYNC_ACCESS_TOKEN;
	if (!accessToken) {
		console.error("Error: POLAR_SYNC_ACCESS_TOKEN is not set");
		process.exit(1);
	}

	const polar = new Polar({ accessToken, server });

	console.log("\nFetching existing resources...");
	const [meters, benefits, products] = await Promise.all([
		fetchAllMeters(polar),
		fetchAllBenefits(polar),
		fetchAllProducts(polar),
	]);

	console.log(
		`  Found ${meters.size} meters, ${benefits.size} benefits, ${products.size} products`,
	);

	const ctx: SyncContext = {
		polar,
		dryRun: true,
		recreate,
		meters,
		benefits,
		products,
	};

	console.log("\nPlanned changes:");
	await syncMeters(ctx);
	await syncBenefits(ctx);
	await syncProducts(ctx);
	await syncOneTimeProducts(ctx);

	if (dryRun) {
		console.log(`\n${"=".repeat(50)}`);
		console.log("Dry-run complete. No changes were made.");
		return;
	}

	console.log("");
	const confirmed = autoConfirm || (await prompt("Apply these changes?"));
	if (!confirmed) {
		console.log("Aborted.");
		process.exit(0);
	}

	ctx.dryRun = false;
	ctx.meters = await fetchAllMeters(polar);
	ctx.benefits = await fetchAllBenefits(polar);
	ctx.products = await fetchAllProducts(polar);

	console.log("\nApplying changes:");
	await syncMeters(ctx);
	await syncBenefits(ctx);
	await syncProducts(ctx);
	await syncOneTimeProducts(ctx);

	console.log(`\n${"=".repeat(50)}`);
	console.log("Sync complete!");

	console.log("\nEnvironment variables:");

	console.log("\n  # Meters");
	for (const meterConfig of CONFIG.meters) {
		const meter = ctx.meters.get(meterConfig.name);
		if (meter) {
			const envKey = `POLAR_${meterConfig.name.toUpperCase().replace(/\s+/g, "_")}_METER_ID`;
			console.log(`  ${envKey}="${meter.id}"`);
		}
	}

	console.log("\n  # Products");
	for (const productConfig of CONFIG.products) {
		const product = ctx.products.get(productConfig.name);
		if (product) {
			const envKey = `POLAR_PRODUCT_${productConfig.name.toUpperCase()}_ID`;
			console.log(`  ${envKey}="${product.id}"`);
		}
	}

	console.log("\n  # One-Time Products");
	for (const productConfig of CONFIG.oneTimeProducts) {
		const product = ctx.products.get(productConfig.name);
		if (product) {
			const envKey = `POLAR_PRODUCT_${productConfig.name.toUpperCase().replace(/\s+/g, "_").replace(/\$/g, "")}_ID`;
			console.log(`  ${envKey}="${product.id}"`);
		}
	}

	process.exit(0);
}

main().catch((error) => {
	console.error("\nSync failed:", error);
	process.exit(1);
});
