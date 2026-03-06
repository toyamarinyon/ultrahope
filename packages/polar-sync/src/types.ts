import type { Polar } from "@polar-sh/sdk";

export type Meter = Awaited<ReturnType<Polar["meters"]["get"]>>;
export type Benefit = Awaited<ReturnType<Polar["benefits"]["get"]>>;
export type Product = Awaited<ReturnType<Polar["products"]["get"]>>;
export type MeterCreateInput = Parameters<Polar["meters"]["create"]>[0];
export type MeterUpdateInput = Parameters<Polar["meters"]["update"]>[0];
export type BenefitCreateInput = Parameters<Polar["benefits"]["create"]>[0];
export type BenefitUpdateInput = Parameters<Polar["benefits"]["update"]>[0];
export type ProductCreateInput = Parameters<Polar["products"]["create"]>[0];
export type ProductCreatePrice = NonNullable<
	ProductCreateInput["prices"]
>[number];
export type ProductUpdateInput = Parameters<Polar["products"]["update"]>[0];

export type PolarServer = "production" | "sandbox";
export type SyncResourceKind = "meter" | "benefit" | "product";

export interface ManagedMetadata extends Record<string, string> {
	managed_by: "ultrahope";
	resource_kind: SyncResourceKind;
	resource_key: string;
}

export interface MeterConfig {
	key: string;
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

export interface BenefitConfig {
	key: string;
	type: "meter_credit";
	description: string;
	meterKey: string;
	units: number;
	rollover: boolean;
}

export interface ProductPriceConfig {
	amountType: "free" | "fixed" | "metered_unit";
	priceAmount?: number;
	priceCurrency?: string;
	meterKey?: string;
}

export interface ProductConfigBase {
	key: string;
	name: string;
	description: string;
	prices: ProductPriceConfig[];
	benefitKeys: string[];
}

export interface ProductConfig extends ProductConfigBase {
	recurringInterval: "month" | "year";
}

export interface OneTimeProductConfig extends ProductConfigBase {}

export interface Config {
	meters: MeterConfig[];
	benefits: BenefitConfig[];
	products: ProductConfig[];
	oneTimeProducts: OneTimeProductConfig[];
}

export type SyncableProductConfig = ProductConfig | OneTimeProductConfig;
export type MeterLookup = Map<string, Meter>;

export type ExistingProductPriceLike = {
	amountType: Product["prices"][number]["amountType"];
	priceAmount?: number;
	priceCurrency?: string;
	unitAmount?: string;
	meterId?: string;
};

export interface DiscoveredMeters {
	all: Meter[];
	byManagedKey: MeterLookup;
	byName: Map<string, Meter>;
}

export interface DiscoveredBenefits {
	all: Benefit[];
	byManagedKey: Map<string, Benefit>;
	byDescription: Map<string, Benefit>;
}

export interface DiscoveredProducts {
	all: Product[];
	byManagedKey: Map<string, Product>;
	byName: Map<string, Product>;
}

export interface DiscoveredState {
	meters: DiscoveredMeters;
	benefits: DiscoveredBenefits;
	products: DiscoveredProducts;
}

export interface ApplyState {
	polar: Polar;
	meters: Map<string, Meter>;
	benefits: Map<string, Benefit>;
	products: Map<string, Product>;
}

export type SyncAction =
	| { kind: "CreateMeter"; config: MeterConfig }
	| {
			kind: "UpdateMeter";
			existingId: string;
			config: MeterConfig;
			changes: string[];
	  }
	| { kind: "CreateBenefit"; config: BenefitConfig }
	| {
			kind: "UpdateBenefit";
			existingId: string;
			config: BenefitConfig;
			changes: string[];
			meterKey: string;
	  }
	| { kind: "CreateProduct"; config: SyncableProductConfig }
	| {
			kind: "UpdateProduct";
			existingId: string;
			config: SyncableProductConfig;
			changes: string[];
			changeBenefits: boolean;
	  }
	| {
			kind: "UpdateProductPrices";
			existingId: string;
			config: SyncableProductConfig;
			reason: string;
	  }
	| {
			kind: "RecreateProduct";
			existingId: string;
			config: SyncableProductConfig;
			reason: string;
	  }
	| {
			kind: "ArchiveProduct";
			existingId: string;
			configKey: string;
			reason: string;
	  }
	| {
			kind: "Noop";
			configKey: string;
			resource: SyncResourceKind;
			reason: string;
	  };

export type PriceSyncDecision =
	| { kind: "match"; details: "" }
	| { kind: "update"; details: string }
	| { kind: "recreate"; details: string };

export function isRecurringProduct(
	config: SyncableProductConfig,
): config is ProductConfig {
	return "recurringInterval" in config;
}
