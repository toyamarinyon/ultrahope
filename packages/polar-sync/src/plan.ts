import { isManaged } from "./metadata";
import { classifyPriceSync } from "./pricing";
import {
	buildResolvedBenefitLookup,
	buildResolvedMeterLookup,
	resolveExistingBenefit,
	resolveExistingMeter,
	resolveExistingProduct,
} from "./resolution";
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
	MeterLookup,
	Product,
	SyncAction,
	SyncableProductConfig,
} from "./types";
import { isRecurringProduct } from "./types";

function isSameAggregation(
	expected: MeterConfig["aggregation"],
	existing: Meter["aggregation"],
): boolean {
	if (expected.func !== existing.func) return false;

	if (expected.func === "count") {
		return !("property" in existing);
	}

	if (!("property" in existing)) {
		return false;
	}

	return expected.property === existing.property;
}

function isFilterClause(
	clause: Meter["filter"]["clauses"][number],
): clause is Extract<Meter["filter"]["clauses"][number], { property: string }> {
	return "property" in clause && "operator" in clause && "value" in clause;
}

function isSameFilter(
	expected: MeterConfig["filter"],
	existing: Meter["filter"],
): boolean {
	if (
		expected.conjunction !== existing.conjunction ||
		expected.clauses.length !== existing.clauses.length
	) {
		return false;
	}

	for (let i = 0; i < expected.clauses.length; i++) {
		const a = expected.clauses[i];
		const b = existing.clauses[i];
		if (!isFilterClause(b)) {
			return false;
		}
		if (
			a.property !== b.property ||
			a.operator !== b.operator ||
			a.value !== b.value
		) {
			return false;
		}
	}

	return true;
}

function sortIds(ids: string[]): string[] {
	return [...ids].sort();
}

function compareBenefitIds(existing: Product, targetIds: string[]): boolean {
	const existingBenefitIds = sortIds(
		existing.benefits.map((benefit: { id: string }) => benefit.id),
	);
	const expectedBenefitIds = sortIds(targetIds);
	if (existingBenefitIds.length !== expectedBenefitIds.length) return false;

	for (let i = 0; i < existingBenefitIds.length; i++) {
		if (existingBenefitIds[i] !== expectedBenefitIds[i]) return false;
	}

	return true;
}

function parseMeterDiff(existing: Meter, config: MeterConfig): string[] {
	const changes: string[] = [];
	if (!isManaged(existing, "meter")) {
		changes.push("managed metadata");
	}
	if (existing.name !== config.name) {
		changes.push(`name: ${existing.name} -> ${config.name}`);
	}
	if (!isSameFilter(config.filter, existing.filter)) {
		changes.push("filter");
	}
	if (!isSameAggregation(config.aggregation, existing.aggregation)) {
		changes.push("aggregation");
	}
	return changes;
}

function parseBenefitDiff(
	existing: Benefit,
	config: BenefitConfig,
	meters: MeterLookup,
	plannedMeters: Set<string>,
): string[] {
	const changes: string[] = [];
	if (!isManaged(existing, "benefit")) {
		changes.push("managed metadata");
	}
	if (existing.description !== config.description) {
		changes.push(
			`description: ${existing.description} -> ${config.description}`,
		);
	}
	if (existing.type !== config.type) {
		changes.push(`type: ${existing.type} -> ${config.type}`);
		return changes;
	}

	const meter = meters.get(config.meterKey);
	if (!meter) {
		if (plannedMeters.has(config.meterKey)) {
			changes.push(`meter "${config.meterKey}" will be created`);
		} else {
			changes.push(`meter "${config.meterKey}" not found`);
			return changes;
		}
	} else if (existing.properties.meterId !== meter.id) {
		changes.push("meter");
	}

	if (existing.properties.units !== config.units) {
		changes.push("units");
	}
	if (existing.properties.rollover !== config.rollover) {
		changes.push("rollover");
	}

	return changes;
}

function resolveBenefitIdsForPlan(
	benefitKeys: string[],
	benefitsByKey: Map<string, Benefit>,
	plannedBenefitCreates: Set<string>,
): {
	benefitIds: string[];
	unresolvedKeys: string[];
	missingKeys: string[];
} {
	const benefitIds: string[] = [];
	const unresolvedKeys: string[] = [];
	const missingKeys: string[] = [];

	for (const key of benefitKeys) {
		const benefit = benefitsByKey.get(key);
		if (benefit) {
			benefitIds.push(benefit.id);
			continue;
		}
		if (plannedBenefitCreates.has(key)) {
			unresolvedKeys.push(key);
		} else {
			missingKeys.push(key);
		}
	}

	return { benefitIds, unresolvedKeys, missingKeys };
}

export function resolveBenefitIdsForApply(
	benefitKeys: string[],
	benefitsByKey: Map<string, Benefit>,
): string[] {
	const missing: string[] = [];
	const ids = benefitKeys
		.map((key) => {
			const benefit = benefitsByKey.get(key);
			if (!benefit) {
				missing.push(key);
				return null;
			}
			return benefit.id;
		})
		.filter((it): it is string => it !== null);

	if (missing.length > 0) {
		throw new Error(`Missing benefits in apply state: ${missing.join(", ")}`);
	}

	return ids;
}

function classifyProductLifecycleChange(
	existing: Product,
	config: SyncableProductConfig,
): string | null {
	const existingIsRecurring = existing.recurringInterval !== null;
	const targetIsRecurring = isRecurringProduct(config);

	if (existingIsRecurring !== targetIsRecurring) {
		return `billing model: ${existingIsRecurring ? "recurring" : "one-time"} -> ${
			targetIsRecurring ? `recurring (${config.recurringInterval})` : "one-time"
		}`;
	}

	if (
		targetIsRecurring &&
		existing.recurringInterval !== config.recurringInterval
	) {
		return `billing interval: ${existing.recurringInterval} -> ${config.recurringInterval}`;
	}

	return null;
}

function parseProductDiff(
	existing: Product,
	config: SyncableProductConfig,
	benefitsByKey: Map<string, Benefit>,
	plannedBenefitCreates: Set<string>,
	meterLookup: MeterLookup,
	recreate: boolean,
): SyncAction[] {
	const actions: SyncAction[] = [];
	const changes: string[] = [];

	if (!isManaged(existing, "product")) {
		changes.push("managed metadata");
	}
	if (existing.name !== config.name) {
		changes.push(`name: ${existing.name} -> ${config.name}`);
	}
	if (existing.description !== config.description) {
		changes.push("description");
	}

	const lifecycleChange = classifyProductLifecycleChange(existing, config);
	if (lifecycleChange) {
		if (recreate) {
			actions.push({
				kind: "ArchiveProduct",
				existingId: existing.id,
				configKey: config.key,
				reason: lifecycleChange,
			});
			actions.push({ kind: "CreateProduct", config });
			return actions;
		}

		actions.push({
			kind: "RecreateProduct",
			existingId: existing.id,
			config,
			reason: lifecycleChange,
		});
		return actions;
	}

	const { benefitIds, unresolvedKeys, missingKeys } = resolveBenefitIdsForPlan(
		config.benefitKeys,
		benefitsByKey,
		plannedBenefitCreates,
	);
	const benefitMismatch = !(
		missingKeys.length === 0 &&
		unresolvedKeys.length === 0 &&
		compareBenefitIds(existing, benefitIds)
	);
	if (unresolvedKeys.length > 0) {
		changes.push(`benefit keys will be created: ${unresolvedKeys.join(", ")}`);
	}
	if (missingKeys.length > 0) {
		changes.push(`missing benefit keys: ${missingKeys.join(", ")}`);
	}
	if (
		benefitMismatch &&
		unresolvedKeys.length === 0 &&
		missingKeys.length === 0
	) {
		changes.push("benefits");
	}

	const priceDecision = classifyPriceSync(
		existing.prices,
		config.prices,
		meterLookup,
	);
	if (priceDecision.kind === "recreate") {
		if (recreate) {
			actions.push({
				kind: "ArchiveProduct",
				existingId: existing.id,
				configKey: config.key,
				reason: priceDecision.details,
			});
			actions.push({ kind: "CreateProduct", config });
			return actions;
		}
		actions.push({
			kind: "RecreateProduct",
			existingId: existing.id,
			config,
			reason: priceDecision.details,
		});
		return actions;
	}

	if (priceDecision.kind === "update") {
		actions.push({
			kind: "UpdateProductPrices",
			existingId: existing.id,
			config,
			reason: priceDecision.details,
		});
	}

	if (
		changes.length > 0 ||
		(missingKeys.length === 0 && unresolvedKeys.length === 0 && benefitMismatch)
	) {
		actions.push({
			kind: "UpdateProduct",
			existingId: existing.id,
			config,
			changes,
			changeBenefits: benefitMismatch,
		});
	}

	if (changes.length === 0 && priceDecision.kind === "match") {
		actions.push({
			kind: "Noop",
			configKey: config.key,
			resource: "product",
			reason: "no changes",
		});
	}

	return actions;
}

function parseMeterActions(
	config: MeterConfig,
	discovered: DiscoveredMeters,
): SyncAction[] {
	const actions: SyncAction[] = [];
	const existing = resolveExistingMeter(config, discovered);

	if (!existing) {
		actions.push({ kind: "CreateMeter", config });
		return actions;
	}

	const changes = parseMeterDiff(existing, config);
	if (changes.length === 0) {
		actions.push({
			kind: "Noop",
			configKey: config.key,
			resource: "meter",
			reason: "no changes",
		});
		return actions;
	}

	actions.push({
		kind: "UpdateMeter",
		existingId: existing.id,
		config,
		changes,
	});

	return actions;
}

function parseBenefitActions(
	config: BenefitConfig,
	discovered: DiscoveredBenefits,
	resolvedMeters: MeterLookup,
	plannedMeters: Set<string>,
): SyncAction[] {
	const actions: SyncAction[] = [];
	const existing = resolveExistingBenefit(config, discovered);

	if (!existing) {
		actions.push({ kind: "CreateBenefit", config });
		return actions;
	}

	const changes = parseBenefitDiff(
		existing,
		config,
		resolvedMeters,
		plannedMeters,
	);

	if (changes.length === 0) {
		actions.push({
			kind: "Noop",
			configKey: config.key,
			resource: "benefit",
			reason: "no changes",
		});
		return actions;
	}

	actions.push({
		kind: "UpdateBenefit",
		existingId: existing.id,
		config,
		changes,
		meterKey: config.meterKey,
	});

	return actions;
}

function parseProductActions(
	productConfigs: SyncableProductConfig[],
	discovered: DiscoveredProducts,
	benefitsByKey: Map<string, Benefit>,
	plannedBenefitCreates: Set<string>,
	meterLookup: MeterLookup,
	recreate: boolean,
): SyncAction[] {
	const actions: SyncAction[] = [];

	for (const productConfig of productConfigs) {
		const existing = resolveExistingProduct(productConfig, discovered);

		if (!existing) {
			actions.push({ kind: "CreateProduct", config: productConfig });
			continue;
		}

		actions.push(
			...parseProductDiff(
				existing,
				productConfig,
				benefitsByKey,
				plannedBenefitCreates,
				meterLookup,
				recreate,
			),
		);
	}

	return actions;
}

export function buildPlan(
	config: Config,
	discovered: DiscoveredState,
	options: { recreate: boolean },
): SyncAction[] {
	const plan: SyncAction[] = [];
	const createdMeters = new Set<string>();
	const createdBenefits = new Set<string>();
	const resolvedMeters = buildResolvedMeterLookup(
		config.meters,
		discovered.meters,
	);
	const resolvedBenefits = buildResolvedBenefitLookup(
		config.benefits,
		discovered.benefits,
	);

	for (const meterConfig of config.meters) {
		const actions = parseMeterActions(meterConfig, discovered.meters);
		if (actions.some((action) => action.kind === "CreateMeter")) {
			createdMeters.add(meterConfig.key);
		}
		plan.push(...actions);
	}

	for (const benefitConfig of config.benefits) {
		const actions = parseBenefitActions(
			benefitConfig,
			discovered.benefits,
			resolvedMeters,
			createdMeters,
		);
		if (actions.some((action) => action.kind === "CreateBenefit")) {
			createdBenefits.add(benefitConfig.key);
		}
		plan.push(...actions);
	}

	plan.push(
		...parseProductActions(
			config.products,
			discovered.products,
			resolvedBenefits,
			createdBenefits,
			resolvedMeters,
			options.recreate,
		),
	);
	plan.push(
		...parseProductActions(
			config.oneTimeProducts,
			discovered.products,
			resolvedBenefits,
			createdBenefits,
			resolvedMeters,
			options.recreate,
		),
	);

	return plan;
}
