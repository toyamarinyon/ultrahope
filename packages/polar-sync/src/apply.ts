import { withManagedMetadata } from "./metadata";
import { log } from "./output";
import { resolveBenefitIdsForApply } from "./plan";
import { buildProductPrices } from "./pricing";
import type {
	ApplyState,
	Benefit,
	BenefitCreateInput,
	BenefitUpdateInput,
	Meter,
	MeterConfig,
	MeterCreateInput,
	MeterUpdateInput,
	Product,
	ProductCreateInput,
	ProductUpdateInput,
	SyncAction,
} from "./types";
import { isRecurringProduct } from "./types";

function aggregateForCreate(
	aggregation: MeterConfig["aggregation"],
): Meter["aggregation"] {
	return aggregation.func === "count"
		? { func: "count" }
		: {
				func: aggregation.func as "sum" | "avg" | "min" | "max",
				property: aggregation.property ?? "",
			};
}

function hasMeterChange(
	changes: string[],
	target: "name" | "filter" | "aggregation",
): boolean {
	if (target === "name") {
		return changes.some((change) => change.startsWith("name: "));
	}

	return changes.includes(target);
}

function buildMeterUpdatePayload(
	config: MeterConfig,
	changes: string[],
): MeterUpdateInput["meterUpdate"] {
	const payload: MeterUpdateInput["meterUpdate"] = {
		metadata: withManagedMetadata("meter", config.key, {}).metadata,
	};

	if (hasMeterChange(changes, "name")) {
		payload.name = config.name;
	}

	if (hasMeterChange(changes, "filter")) {
		payload.filter = config.filter;
	}

	if (hasMeterChange(changes, "aggregation")) {
		payload.aggregation = aggregateForCreate(config.aggregation);
	}

	return payload;
}

async function applyAction(
	action: SyncAction,
	state: ApplyState,
): Promise<void> {
	switch (action.kind) {
		case "CreateMeter": {
			const payload: MeterCreateInput = withManagedMetadata(
				"meter",
				action.config.key,
				{
					name: action.config.name,
					filter: action.config.filter,
					aggregation: aggregateForCreate(action.config.aggregation),
				},
			);
			const created = await state.polar.meters.create(payload);
			state.meters.set(action.config.key, created as Meter);
			log("+", "Meter", action.config.name, `created id=${created.id}`);
			return;
		}
		case "UpdateMeter": {
			const request: MeterUpdateInput = {
				id: action.existingId,
				meterUpdate: buildMeterUpdatePayload(action.config, action.changes),
			};
			const updated = await state.polar.meters.update(request);
			state.meters.set(action.config.key, updated as Meter);
			log("~", "Meter", action.config.name, `updated id=${action.existingId}`);
			return;
		}
		case "CreateBenefit": {
			const meter = state.meters.get(action.config.meterKey);
			if (!meter) {
				throw new Error(
					`Cannot create benefit "${action.config.key}": meter "${action.config.meterKey}" is not available`,
				);
			}
			const payload: BenefitCreateInput = withManagedMetadata(
				"benefit",
				action.config.key,
				{
					type: action.config.type,
					description: action.config.description,
					properties: {
						units: action.config.units,
						rollover: action.config.rollover,
						meterId: meter.id,
					},
				},
			);
			const created = await state.polar.benefits.create(payload);
			state.benefits.set(action.config.key, created as Benefit);
			log(
				"+",
				"Benefit",
				action.config.description,
				`created id=${created.id}`,
			);
			return;
		}
		case "UpdateBenefit": {
			const meter = state.meters.get(action.meterKey);
			if (!meter) {
				throw new Error(
					`Cannot update benefit "${action.config.key}": meter "${action.meterKey}" is not available`,
				);
			}
			const payload = withManagedMetadata("benefit", action.config.key, {
				type: action.config.type,
				description: action.config.description,
				properties: {
					units: action.config.units,
					rollover: action.config.rollover,
					meterId: meter.id,
				},
			});
			const request: BenefitUpdateInput = {
				id: action.existingId,
				requestBody: payload,
			};
			const updated = await state.polar.benefits.update(request);
			state.benefits.set(action.config.key, updated as Benefit);
			log(
				"~",
				"Benefit",
				action.config.description,
				`updated id=${action.existingId}`,
			);
			return;
		}
		case "CreateProduct": {
			const payload: ProductCreateInput = isRecurringProduct(action.config)
				? withManagedMetadata("product", action.config.key, {
						name: action.config.name,
						description: action.config.description,
						recurringInterval: action.config.recurringInterval,
						prices: buildProductPrices(action.config.prices, state.meters),
					})
				: withManagedMetadata("product", action.config.key, {
						name: action.config.name,
						description: action.config.description,
						prices: buildProductPrices(action.config.prices, state.meters),
					});

			const created = await state.polar.products.create(payload);
			const benefitIds = resolveBenefitIdsForApply(
				action.config.benefitKeys,
				state.benefits,
			);
			if (benefitIds.length > 0) {
				await state.polar.products.updateBenefits({
					id: created.id,
					productBenefitsUpdate: { benefits: benefitIds },
				});
			}

			state.products.set(action.config.key, created as Product);
			log("+", "Product", action.config.name, `created id=${created.id}`);
			return;
		}
		case "UpdateProduct": {
			const productUpdate = withManagedMetadata("product", action.config.key, {
				name: action.config.name,
				description: action.config.description,
			});
			const request: ProductUpdateInput = {
				id: action.existingId,
				productUpdate,
			};

			const updated = await state.polar.products.update(request);
			if (action.changeBenefits) {
				const benefitIds = resolveBenefitIdsForApply(
					action.config.benefitKeys,
					state.benefits,
				);
				await state.polar.products.updateBenefits({
					id: action.existingId,
					productBenefitsUpdate: { benefits: benefitIds },
				});
			}
			state.products.set(action.config.key, updated as Product);
			log(
				"~",
				"Product",
				action.config.name,
				action.changeBenefits ? "updated (details and/or benefits)" : "updated",
			);
			return;
		}
		case "UpdateProductPrices": {
			const request: ProductUpdateInput = {
				id: action.existingId,
				productUpdate: {
					prices: buildProductPrices(action.config.prices, state.meters),
				},
			};
			await state.polar.products.update(request);
			log("~", "Product", action.config.name, "updated prices");
			return;
		}
		case "ArchiveProduct": {
			const request: ProductUpdateInput = {
				id: action.existingId,
				productUpdate: { isArchived: true },
			};
			await state.polar.products.update(request);
			state.products.delete(action.configKey);
			log("-", "Product", action.configKey, "archived");
			return;
		}
		case "RecreateProduct":
			log(
				"!",
				"Product",
				action.config.key,
				`recreate blocked (missing --recreate): ${action.reason}`,
			);
			return;
		case "Noop":
			log("✓", "Resource", action.configKey, action.reason);
			return;
		default:
			return;
	}
}

export async function applyPlan(
	actions: SyncAction[],
	state: ApplyState,
): Promise<void> {
	for (const action of actions) {
		await applyAction(action, state);
	}
}
