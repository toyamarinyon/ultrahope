import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "smol-toml";
import type {
	BenefitConfig,
	Config,
	MeterConfig,
	OneTimeProductConfig,
	ProductConfig,
	ProductConfigBase,
	ProductPriceConfig,
} from "./types";

const DEFAULT_CONFIG_PATH = fileURLToPath(
	new URL("../../../polar.toml", import.meta.url),
);

const METER_FILTER_CONJUNCTIONS = ["and", "or"] as const;
const METER_FILTER_OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte"] as const;
const METER_AGGREGATION_FUNCS = ["sum", "count", "avg", "min", "max"] as const;
const PRODUCT_AMOUNT_TYPES = ["free", "fixed", "metered_unit"] as const;
const PRODUCT_INTERVALS = ["month", "year"] as const;

function invalidConfig(sourcePath: string, message: string): never {
	throw new Error(`Invalid config in ${sourcePath}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectRecord(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): Record<string, unknown> {
	if (!isRecord(value)) {
		invalidConfig(sourcePath, `${fieldPath} must be a table`);
	}

	return value;
}

function expectArray(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): unknown[] {
	if (!Array.isArray(value)) {
		invalidConfig(sourcePath, `${fieldPath} must be an array`);
	}

	return value;
}

function expectNonEmptyString(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		invalidConfig(sourcePath, `${fieldPath} must be a non-empty string`);
	}

	return value;
}

function expectBoolean(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): boolean {
	if (typeof value !== "boolean") {
		invalidConfig(sourcePath, `${fieldPath} must be a boolean`);
	}

	return value;
}

function expectInteger(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): number {
	if (typeof value !== "number" || !Number.isInteger(value)) {
		invalidConfig(sourcePath, `${fieldPath} must be an integer`);
	}

	return value;
}

function expectStringArray(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): string[] {
	return expectArray(value, sourcePath, fieldPath).map((item, index) =>
		expectNonEmptyString(item, sourcePath, `${fieldPath}[${index}]`),
	);
}

function expectEnum<T extends readonly string[]>(
	value: unknown,
	allowed: T,
	sourcePath: string,
	fieldPath: string,
): T[number] {
	if (typeof value !== "string" || !allowed.includes(value as T[number])) {
		invalidConfig(
			sourcePath,
			`${fieldPath} must be one of: ${allowed.join(", ")}`,
		);
	}

	return value as T[number];
}

function expectOptionalString(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	return expectNonEmptyString(value, sourcePath, fieldPath);
}

function parseMeterConfig(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): MeterConfig {
	const record = expectRecord(value, sourcePath, fieldPath);
	const filterRecord = expectRecord(
		record.filter,
		sourcePath,
		`${fieldPath}.filter`,
	);
	const aggregationRecord = expectRecord(
		record.aggregation,
		sourcePath,
		`${fieldPath}.aggregation`,
	);

	const clauses = expectArray(
		filterRecord.clauses,
		sourcePath,
		`${fieldPath}.filter.clauses`,
	).map((item, index) => {
		const clause = expectRecord(
			item,
			sourcePath,
			`${fieldPath}.filter.clauses[${index}]`,
		);
		const clausePath = `${fieldPath}.filter.clauses[${index}]`;
		const clauseValue = clause.value;
		if (
			typeof clauseValue !== "string" &&
			typeof clauseValue !== "number" &&
			typeof clauseValue !== "boolean"
		) {
			invalidConfig(
				sourcePath,
				`${clausePath}.value must be a string, number, or boolean`,
			);
		}

		return {
			property: expectNonEmptyString(
				clause.property,
				sourcePath,
				`${clausePath}.property`,
			),
			operator: expectEnum(
				clause.operator,
				METER_FILTER_OPERATORS,
				sourcePath,
				`${clausePath}.operator`,
			),
			value: clauseValue,
		};
	});

	const aggregationFunc = expectEnum(
		aggregationRecord.func,
		METER_AGGREGATION_FUNCS,
		sourcePath,
		`${fieldPath}.aggregation.func`,
	);
	const aggregationProperty = expectOptionalString(
		aggregationRecord.property,
		sourcePath,
		`${fieldPath}.aggregation.property`,
	);

	if (aggregationFunc !== "count" && aggregationProperty === undefined) {
		invalidConfig(
			sourcePath,
			`${fieldPath}.aggregation.property is required when func is ${aggregationFunc}`,
		);
	}

	return {
		key: expectNonEmptyString(record.key, sourcePath, `${fieldPath}.key`),
		name: expectNonEmptyString(record.name, sourcePath, `${fieldPath}.name`),
		filter: {
			conjunction: expectEnum(
				filterRecord.conjunction,
				METER_FILTER_CONJUNCTIONS,
				sourcePath,
				`${fieldPath}.filter.conjunction`,
			),
			clauses,
		},
		aggregation: {
			func: aggregationFunc,
			...(aggregationProperty ? { property: aggregationProperty } : {}),
		},
	};
}

function parseBenefitConfig(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): BenefitConfig {
	const record = expectRecord(value, sourcePath, fieldPath);

	return {
		key: expectNonEmptyString(record.key, sourcePath, `${fieldPath}.key`),
		type: expectEnum(
			record.type,
			["meter_credit"] as const,
			sourcePath,
			`${fieldPath}.type`,
		),
		description: expectNonEmptyString(
			record.description,
			sourcePath,
			`${fieldPath}.description`,
		),
		meterKey: expectNonEmptyString(
			record.meterKey,
			sourcePath,
			`${fieldPath}.meterKey`,
		),
		units: expectInteger(record.units, sourcePath, `${fieldPath}.units`),
		rollover: expectBoolean(
			record.rollover,
			sourcePath,
			`${fieldPath}.rollover`,
		),
	};
}

function parsePriceConfig(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): ProductPriceConfig {
	const record = expectRecord(value, sourcePath, fieldPath);
	const amountType = expectEnum(
		record.amountType,
		PRODUCT_AMOUNT_TYPES,
		sourcePath,
		`${fieldPath}.amountType`,
	);
	const priceAmount =
		record.priceAmount === undefined
			? undefined
			: expectInteger(
					record.priceAmount,
					sourcePath,
					`${fieldPath}.priceAmount`,
				);
	const priceCurrency = expectOptionalString(
		record.priceCurrency,
		sourcePath,
		`${fieldPath}.priceCurrency`,
	);
	const meterKey = expectOptionalString(
		record.meterKey,
		sourcePath,
		`${fieldPath}.meterKey`,
	);

	if (
		(amountType === "fixed" || amountType === "metered_unit") &&
		priceAmount === undefined
	) {
		invalidConfig(
			sourcePath,
			`${fieldPath}.priceAmount is required when amountType is ${amountType}`,
		);
	}

	if (amountType === "metered_unit" && meterKey === undefined) {
		invalidConfig(
			sourcePath,
			`${fieldPath}.meterKey is required when amountType is metered_unit`,
		);
	}

	return {
		amountType,
		...(priceAmount !== undefined ? { priceAmount } : {}),
		...(priceCurrency ? { priceCurrency } : {}),
		...(meterKey ? { meterKey } : {}),
	};
}

function parseProductBaseConfig(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): ProductConfigBase {
	const record = expectRecord(value, sourcePath, fieldPath);

	return {
		key: expectNonEmptyString(record.key, sourcePath, `${fieldPath}.key`),
		name: expectNonEmptyString(record.name, sourcePath, `${fieldPath}.name`),
		description: expectNonEmptyString(
			record.description,
			sourcePath,
			`${fieldPath}.description`,
		),
		prices: expectArray(record.prices, sourcePath, `${fieldPath}.prices`).map(
			(item, index) =>
				parsePriceConfig(item, sourcePath, `${fieldPath}.prices[${index}]`),
		),
		benefitKeys: expectStringArray(
			record.benefitKeys,
			sourcePath,
			`${fieldPath}.benefitKeys`,
		),
	};
}

function parseRecurringProductConfig(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): ProductConfig {
	const base = parseProductBaseConfig(value, sourcePath, fieldPath);
	const record = expectRecord(value, sourcePath, fieldPath);

	return {
		...base,
		recurringInterval: expectEnum(
			record.recurringInterval,
			PRODUCT_INTERVALS,
			sourcePath,
			`${fieldPath}.recurringInterval`,
		),
	};
}

function parseOneTimeProductConfig(
	value: unknown,
	sourcePath: string,
	fieldPath: string,
): OneTimeProductConfig {
	return parseProductBaseConfig(value, sourcePath, fieldPath);
}

function assertUniqueValues(
	values: string[],
	sourcePath: string,
	fieldPath: string,
): void {
	const seen = new Set<string>();

	for (const value of values) {
		if (seen.has(value)) {
			invalidConfig(
				sourcePath,
				`${fieldPath} contains duplicate value "${value}"`,
			);
		}
		seen.add(value);
	}
}

function validateConfigReferences(config: Config, sourcePath: string): void {
	const meterKeys = new Set(config.meters.map((meter) => meter.key));
	const benefitKeys = new Set(config.benefits.map((benefit) => benefit.key));

	assertUniqueValues(
		config.meters.map((meter) => meter.key),
		sourcePath,
		"meters[*].key",
	);
	assertUniqueValues(
		config.meters.map((meter) => meter.name),
		sourcePath,
		"meters[*].name",
	);
	assertUniqueValues(
		config.benefits.map((benefit) => benefit.key),
		sourcePath,
		"benefits[*].key",
	);
	assertUniqueValues(
		config.benefits.map((benefit) => benefit.description),
		sourcePath,
		"benefits[*].description",
	);
	assertUniqueValues(
		[
			...config.products.map((product) => product.key),
			...config.oneTimeProducts.map((product) => product.key),
		],
		sourcePath,
		"products[*].key / oneTimeProducts[*].key",
	);
	assertUniqueValues(
		[
			...config.products.map((product) => product.name),
			...config.oneTimeProducts.map((product) => product.name),
		],
		sourcePath,
		"products[*].name / oneTimeProducts[*].name",
	);

	for (const benefit of config.benefits) {
		if (!meterKeys.has(benefit.meterKey)) {
			invalidConfig(
				sourcePath,
				`benefit "${benefit.key}" references unknown meterKey "${benefit.meterKey}"`,
			);
		}
	}

	for (const product of [...config.products, ...config.oneTimeProducts]) {
		for (const benefitKey of product.benefitKeys) {
			if (!benefitKeys.has(benefitKey)) {
				invalidConfig(
					sourcePath,
					`product "${product.key}" references unknown benefitKey "${benefitKey}"`,
				);
			}
		}

		for (const price of product.prices) {
			if (
				price.amountType === "metered_unit" &&
				!meterKeys.has(price.meterKey ?? "")
			) {
				invalidConfig(
					sourcePath,
					`product "${product.key}" references unknown meterKey "${price.meterKey}"`,
				);
			}
		}
	}
}

export function parsePolarSyncConfig(raw: string, sourcePath: string): Config {
	let parsed: unknown;
	try {
		parsed = parse(raw);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to parse TOML config ${sourcePath}: ${message}`);
	}

	const record = expectRecord(parsed, sourcePath, "root");
	const config: Config = {
		meters: expectArray(record.meters, sourcePath, "meters").map(
			(item, index) => parseMeterConfig(item, sourcePath, `meters[${index}]`),
		),
		benefits: expectArray(record.benefits, sourcePath, "benefits").map(
			(item, index) =>
				parseBenefitConfig(item, sourcePath, `benefits[${index}]`),
		),
		products: expectArray(record.products, sourcePath, "products").map(
			(item, index) =>
				parseRecurringProductConfig(item, sourcePath, `products[${index}]`),
		),
		oneTimeProducts: expectArray(
			record.oneTimeProducts,
			sourcePath,
			"oneTimeProducts",
		).map((item, index) =>
			parseOneTimeProductConfig(item, sourcePath, `oneTimeProducts[${index}]`),
		),
	};

	validateConfigReferences(config, sourcePath);

	return config;
}

export function loadConfig(configPath: string): Config {
	let raw = "";
	try {
		raw = readFileSync(configPath, "utf-8");
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to read config file ${configPath}: ${message}`);
	}

	return parsePolarSyncConfig(raw, configPath);
}

export function resolveConfigPath(args: string[]): string {
	const configIndex = args.indexOf("--config");
	if (configIndex === -1) {
		return DEFAULT_CONFIG_PATH;
	}

	const configArg = args[configIndex + 1];
	if (!configArg || configArg.startsWith("--")) {
		throw new Error("--config requires a path");
	}

	return resolve(process.cwd(), configArg);
}
