import type {
	Benefit,
	BenefitConfig,
	Config,
	DiscoveredBenefits,
	DiscoveredMeters,
	DiscoveredProducts,
	DiscoveredState,
	Meter,
	MeterConfig,
	Product,
	SyncableProductConfig,
} from "./types";

export function resolveExistingMeter(
	config: MeterConfig,
	discovered: DiscoveredMeters,
): Meter | undefined {
	return (
		discovered.byManagedKey.get(config.key) ??
		discovered.byName.get(config.name)
	);
}

export function resolveExistingBenefit(
	config: BenefitConfig,
	discovered: DiscoveredBenefits,
): Benefit | undefined {
	return (
		discovered.byManagedKey.get(config.key) ??
		discovered.byDescription.get(config.description)
	);
}

export function resolveExistingProduct(
	config: SyncableProductConfig,
	discovered: DiscoveredProducts,
): Product | undefined {
	return (
		discovered.byManagedKey.get(config.key) ??
		discovered.byName.get(config.name)
	);
}

export function buildResolvedMeterLookup(
	configs: MeterConfig[],
	discovered: DiscoveredMeters,
): Map<string, Meter> {
	const lookup = new Map(discovered.byManagedKey);

	for (const config of configs) {
		const existing = resolveExistingMeter(config, discovered);
		if (existing) {
			lookup.set(config.key, existing);
		}
	}

	return lookup;
}

export function buildResolvedBenefitLookup(
	configs: BenefitConfig[],
	discovered: DiscoveredBenefits,
): Map<string, Benefit> {
	const lookup = new Map(discovered.byManagedKey);

	for (const config of configs) {
		const existing = resolveExistingBenefit(config, discovered);
		if (existing) {
			lookup.set(config.key, existing);
		}
	}

	return lookup;
}

function buildResolvedProductLookup(
	configs: SyncableProductConfig[],
	discovered: DiscoveredProducts,
): Map<string, Product> {
	const lookup = new Map(discovered.byManagedKey);

	for (const config of configs) {
		const existing = resolveExistingProduct(config, discovered);
		if (existing) {
			lookup.set(config.key, existing);
		}
	}

	return lookup;
}

export function buildResolvedResourceMaps(
	config: Config,
	discovered: DiscoveredState,
): {
	meters: Map<string, Meter>;
	benefits: Map<string, Benefit>;
	products: Map<string, Product>;
} {
	return {
		meters: buildResolvedMeterLookup(config.meters, discovered.meters),
		benefits: buildResolvedBenefitLookup(config.benefits, discovered.benefits),
		products: buildResolvedProductLookup(
			[...config.products, ...config.oneTimeProducts],
			discovered.products,
		),
	};
}
