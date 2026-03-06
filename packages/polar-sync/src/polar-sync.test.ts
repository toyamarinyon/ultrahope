import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { applyPlan } from "./apply";
import { parsePolarSyncConfig } from "./config";
import { buildManagedMetadata, extractMetadata } from "./metadata";
import { buildPlan } from "./plan";
import { classifyPriceSync } from "./pricing";
import type {
	Benefit,
	Config,
	DiscoveredState,
	Meter,
	Product,
	ProductConfig,
	ProductPriceConfig,
	SyncAction,
} from "./types";

function createMeter(
	overrides: Partial<Meter> & {
		id: string;
		name: string;
	},
): Meter {
	return {
		id: overrides.id,
		name: overrides.name,
		filter: overrides.filter ?? {
			conjunction: "and",
			clauses: [
				{
					property: "name",
					operator: "eq",
					value: "usage",
				},
			],
		},
		aggregation: overrides.aggregation ?? {
			func: "sum",
			property: "cost",
		},
		metadata: overrides.metadata,
	} as Meter;
}

function createBenefit(
	overrides: Partial<Benefit> & {
		id: string;
		description: string;
	},
): Benefit {
	return {
		id: overrides.id,
		type: overrides.type ?? "meter_credit",
		description: overrides.description,
		properties: overrides.properties ?? {
			units: 1_000_000,
			rollover: false,
			meterId: "meter_123",
		},
		metadata: overrides.metadata,
	} as Benefit;
}

function createProduct(
	overrides: Partial<Product> & {
		id: string;
		name: string;
		recurringInterval: Product["recurringInterval"];
	},
): Product {
	return {
		id: overrides.id,
		createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
		modifiedAt: overrides.modifiedAt ?? new Date("2026-01-01T00:00:00Z"),
		trialInterval: overrides.trialInterval ?? null,
		trialIntervalCount: overrides.trialIntervalCount ?? null,
		name: overrides.name,
		description: overrides.description ?? "Product",
		recurringInterval: overrides.recurringInterval,
		recurringIntervalCount:
			overrides.recurringIntervalCount ??
			(overrides.recurringInterval === null ? null : 1),
		isRecurring: overrides.isRecurring ?? overrides.recurringInterval !== null,
		isArchived: overrides.isArchived ?? false,
		organizationId: overrides.organizationId ?? "org_123",
		metadata:
			"metadata" in overrides
				? overrides.metadata
				: buildManagedMetadata("product", "product_pro"),
		prices:
			overrides.prices ??
			([
				{
					amountType: "fixed",
					priceAmount: 300,
					priceCurrency: "usd",
				},
			] as Product["prices"]),
		benefits: overrides.benefits ?? [],
		medias: overrides.medias ?? [],
		attachedCustomFields: overrides.attachedCustomFields ?? [],
	} as Product;
}

function createDiscoveredState({
	meters = [],
	benefits = [],
	products = [],
}: {
	meters?: Meter[];
	benefits?: Benefit[];
	products?: Product[];
} = {}): DiscoveredState {
	const metersByManagedKey = new Map<string, Meter>();
	const metersByName = new Map<string, Meter>();
	for (const meter of meters) {
		metersByName.set(meter.name, meter);
		const metadata = extractMetadata(meter, "meter");
		if (metadata) {
			metersByManagedKey.set(metadata.resource_key, meter);
		}
	}

	const benefitsByManagedKey = new Map<string, Benefit>();
	const benefitsByDescription = new Map<string, Benefit>();
	for (const benefit of benefits) {
		benefitsByDescription.set(benefit.description, benefit);
		const metadata = extractMetadata(benefit, "benefit");
		if (metadata) {
			benefitsByManagedKey.set(metadata.resource_key, benefit);
		}
	}

	const productsByManagedKey = new Map<string, Product>();
	const productsByName = new Map<string, Product>();
	for (const product of products) {
		productsByName.set(product.name, product);
		const metadata = extractMetadata(product, "product");
		if (metadata) {
			productsByManagedKey.set(metadata.resource_key, product);
		}
	}

	return {
		meters: {
			all: meters,
			byManagedKey: metersByManagedKey,
			byName: metersByName,
		},
		benefits: {
			all: benefits,
			byManagedKey: benefitsByManagedKey,
			byDescription: benefitsByDescription,
		},
		products: {
			all: products,
			byManagedKey: productsByManagedKey,
			byName: productsByName,
		},
	};
}

describe("classifyPriceSync", () => {
	it("treats fixed-price amount changes as in-place updates", () => {
		const decision = classifyPriceSync(
			[{ amountType: "fixed", priceAmount: 1000, priceCurrency: "usd" }],
			[{ amountType: "fixed", priceAmount: 300, priceCurrency: "usd" }],
			new Map(),
		);

		expect(decision).toEqual({
			kind: "update",
			details: "price[0]: $10.00 -> $3.00",
		});
	});

	it("requires recreate when the price count changes", () => {
		const decision = classifyPriceSync(
			[{ amountType: "fixed", priceAmount: 1000, priceCurrency: "usd" }],
			[
				{ amountType: "fixed", priceAmount: 300, priceCurrency: "usd" },
				{ amountType: "fixed", priceAmount: 500, priceCurrency: "usd" },
			],
			new Map(),
		);

		expect(decision.kind).toBe("recreate");
		expect(decision.details).toContain("price count");
	});

	it("requires recreate when a fixed-price currency changes", () => {
		const decision = classifyPriceSync(
			[{ amountType: "fixed", priceAmount: 1000, priceCurrency: "usd" }],
			[{ amountType: "fixed", priceAmount: 300, priceCurrency: "eur" }],
			new Map(),
		);

		expect(decision).toEqual({
			kind: "recreate",
			details: "price[0]: currency usd vs eur",
		});
	});

	it("requires recreate when the amount type changes", () => {
		const decision = classifyPriceSync(
			[{ amountType: "free" }],
			[{ amountType: "fixed", priceAmount: 300, priceCurrency: "usd" }],
			new Map(),
		);

		expect(decision).toEqual({
			kind: "recreate",
			details: "price[0]: expected fixed",
		});
	});

	it("applies the same fixed-price update rule to one-time products", () => {
		const decision = classifyPriceSync(
			[{ amountType: "fixed", priceAmount: 2000, priceCurrency: "usd" }],
			[{ amountType: "fixed", priceAmount: 1000, priceCurrency: "usd" }],
			new Map(),
		);

		expect(decision).toEqual({
			kind: "update",
			details: "price[0]: $20.00 -> $10.00",
		});
	});
});

describe("parsePolarSyncConfig", () => {
	it("parses the checked-in TOML config", () => {
		const raw = readFileSync(
			new URL("../../../polar.toml", import.meta.url),
			"utf8",
		);
		const config = parsePolarSyncConfig(raw, "polar.toml");

		expect(config.meters).toHaveLength(1);
		expect(config.benefits.map((benefit) => benefit.key)).toEqual([
			"pro_credits",
			"founder_credits",
			"credit_10",
			"credit_20",
		]);
		expect(config.products.map((product) => product.key)).toEqual([
			"product_free",
			"product_pro",
			"product_founder",
		]);
		expect(config.oneTimeProducts.map((product) => product.key)).toEqual([
			"product_credit_10",
			"product_credit_20",
		]);
	});

	it("rejects products without recurringInterval", () => {
		const invalidToml = `
[[meters]]
key = "usage_cost"
name = "Usage Cost"

[meters.filter]
conjunction = "and"

[[meters.filter.clauses]]
property = "name"
operator = "eq"
value = "usage"

[meters.aggregation]
func = "sum"
property = "cost"

[[benefits]]
key = "pro_credits"
type = "meter_credit"
description = "$1 included credit"
meterKey = "usage_cost"
units = 1_000_000
rollover = false

[[products]]
key = "product_pro"
name = "Pro"
description = "Pro plan"
benefitKeys = ["pro_credits"]

[[products.prices]]
amountType = "fixed"
priceAmount = 300
priceCurrency = "usd"

oneTimeProducts = []
`;

		expect(() => parsePolarSyncConfig(invalidToml, "inline.toml")).toThrow(
			"Invalid config in inline.toml: products[0].recurringInterval must be one of: month, year",
		);
	});

	it("rejects unsupported custom prices during config parsing", () => {
		const invalidToml = `
meters = []
benefits = []
products = []

[[oneTimeProducts]]
key = "product_custom"
name = "Custom"
description = "Custom price"
benefitKeys = []

[[oneTimeProducts.prices]]
amountType = "custom"
`;

		expect(() => parsePolarSyncConfig(invalidToml, "inline.toml")).toThrow(
			"Invalid config in inline.toml: oneTimeProducts[0].prices[0].amountType must be one of: free, fixed, metered_unit",
		);
	});
});

describe("extractMetadata", () => {
	it("requires the requested resource kind to match", () => {
		expect(
			extractMetadata(
				{
					metadata: buildManagedMetadata("benefit", "benefit_pro"),
				},
				"meter",
			),
		).toBeNull();
	});
});

describe("buildPlan", () => {
	it("requires recreate when a recurring interval changes", () => {
		const config: Config = {
			meters: [],
			benefits: [],
			products: [
				{
					key: "product_pro",
					name: "Pro",
					description: "Pro plan",
					recurringInterval: "year",
					prices: [
						{
							amountType: "fixed",
							priceAmount: 300,
							priceCurrency: "usd",
						},
					],
					benefitKeys: [],
				},
			],
			oneTimeProducts: [],
		};
		const discovered = createDiscoveredState({
			products: [
				createProduct({
					id: "prod_123",
					name: "Pro",
					description: "Pro plan",
					recurringInterval: "month",
				}),
			],
		});

		const plan = buildPlan(config, discovered, { recreate: false });

		expect(plan).toHaveLength(1);
		expect(plan[0]).toEqual({
			kind: "RecreateProduct",
			existingId: "prod_123",
			config: config.products[0],
			reason: "billing interval: month -> year",
		});
	});

	it("requires recreate when switching from recurring to one-time", () => {
		const oneTimeConfig: ProductPriceConfig = {
			amountType: "fixed",
			priceAmount: 300,
			priceCurrency: "usd",
		};
		const config: Config = {
			meters: [],
			benefits: [],
			products: [],
			oneTimeProducts: [
				{
					key: "product_pro",
					name: "Pro",
					description: "Pro plan",
					prices: [oneTimeConfig],
					benefitKeys: [],
				},
			],
		};
		const discovered = createDiscoveredState({
			products: [
				createProduct({
					id: "prod_456",
					name: "Pro",
					description: "Pro plan",
					recurringInterval: "month",
				}),
			],
		});

		const plan = buildPlan(config, discovered, { recreate: false });

		expect(plan).toHaveLength(1);
		expect(plan[0]).toEqual({
			kind: "RecreateProduct",
			existingId: "prod_456",
			config: config.oneTimeProducts[0],
			reason: "billing model: recurring -> one-time",
		});
	});

	it("archives and recreates when immutable product changes are allowed", () => {
		const recurringConfig: ProductConfig = {
			key: "product_pro",
			name: "Pro",
			description: "Pro plan",
			recurringInterval: "year",
			prices: [
				{
					amountType: "fixed",
					priceAmount: 300,
					priceCurrency: "usd",
				},
			],
			benefitKeys: [],
		};
		const discovered = createDiscoveredState({
			products: [
				createProduct({
					id: "prod_789",
					name: "Pro",
					description: "Pro plan",
					recurringInterval: "month",
				}),
			],
		});

		const plan = buildPlan(
			{
				meters: [],
				benefits: [],
				products: [recurringConfig],
				oneTimeProducts: [],
			},
			discovered,
			{ recreate: true },
		);

		expect(plan).toEqual([
			{
				kind: "ArchiveProduct",
				existingId: "prod_789",
				configKey: "product_pro",
				reason: "billing interval: month -> year",
			},
			{
				kind: "CreateProduct",
				config: recurringConfig,
			},
		]);
	});

	it("reuses adopted meters and benefits for dependent updates", () => {
		const config: Config = {
			meters: [
				{
					key: "usage_cost",
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
						property: "cost",
					},
				},
			],
			benefits: [
				{
					key: "founder_credits",
					type: "meter_credit",
					description: "Founder unlimited credit",
					meterKey: "usage_cost",
					units: 1_000_000,
					rollover: false,
				},
			],
			products: [
				{
					key: "product_founder",
					name: "Founder",
					description: "Founder plan",
					recurringInterval: "month",
					prices: [
						{
							amountType: "fixed",
							priceAmount: 300,
							priceCurrency: "usd",
						},
					],
					benefitKeys: ["founder_credits"],
				},
			],
			oneTimeProducts: [],
		};
		const meter = createMeter({
			id: "meter_123",
			name: "Usage Cost",
			metadata: undefined,
		});
		const benefit = createBenefit({
			id: "benefit_123",
			description: "Founder unlimited credit",
			properties: {
				units: 1_000_000,
				rollover: false,
				meterId: meter.id,
			},
			metadata: undefined,
		});
		const product = createProduct({
			id: "product_123",
			name: "Founder",
			description: "Founder plan",
			recurringInterval: "month",
			benefits: [{ id: benefit.id } as Product["benefits"][number]],
			metadata: undefined,
		});
		const discovered = createDiscoveredState({
			meters: [meter],
			benefits: [benefit],
			products: [product],
		});

		const plan = buildPlan(config, discovered, { recreate: false });

		expect(plan).toEqual([
			{
				kind: "UpdateMeter",
				existingId: "meter_123",
				config: config.meters[0],
				changes: ["managed metadata"],
			},
			{
				kind: "UpdateBenefit",
				existingId: "benefit_123",
				config: config.benefits[0],
				changes: ["managed metadata"],
				meterKey: "usage_cost",
			},
			{
				kind: "UpdateProduct",
				existingId: "product_123",
				config: config.products[0],
				changes: ["managed metadata"],
				changeBenefits: false,
			},
		]);
	});
});

describe("applyPlan", () => {
	it("omits unchanged immutable meter fields from metadata-only meter updates", async () => {
		const config: Config["meters"][number] = {
			key: "usage_cost",
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
				property: "cost",
			},
		};
		const requests: unknown[] = [];
		const updatedMeter = createMeter({
			id: "meter_123",
			name: "Usage Cost",
			metadata: buildManagedMetadata("meter", "usage_cost"),
		});
		const actions: SyncAction[] = [
			{
				kind: "UpdateMeter",
				existingId: "meter_123",
				config,
				changes: ["managed metadata"],
			},
		];

		await applyPlan(actions, {
			polar: {
				meters: {
					update: async (request: unknown) => {
						requests.push(request);
						return updatedMeter;
					},
				},
			} as never,
			meters: new Map(),
			benefits: new Map(),
			products: new Map(),
		});

		expect(requests).toEqual([
			{
				id: "meter_123",
				meterUpdate: {
					metadata: buildManagedMetadata("meter", "usage_cost"),
				},
			},
		]);
	});
});
