import type { Polar } from "@polar-sh/sdk";
import { extractMetadata } from "./metadata";
import type {
	DiscoveredBenefits,
	DiscoveredMeters,
	DiscoveredProducts,
} from "./types";

export async function fetchAllMeters(polar: Polar): Promise<DiscoveredMeters> {
	const all = [];
	const byManagedKey = new Map();
	const byName = new Map();

	const response = await polar.meters.list({});
	for await (const page of response) {
		for (const meter of page.result.items) {
			all.push(meter);
			byName.set(meter.name, meter);
			const managed = extractMetadata(meter, "meter");
			if (managed) {
				byManagedKey.set(managed.resource_key, meter);
			}
		}
	}

	return { all, byManagedKey, byName };
}

export async function fetchAllBenefits(
	polar: Polar,
): Promise<DiscoveredBenefits> {
	const all = [];
	const byManagedKey = new Map();
	const byDescription = new Map();

	const response = await polar.benefits.list({});
	for await (const page of response) {
		for (const benefit of page.result.items) {
			all.push(benefit);
			byDescription.set(benefit.description, benefit);
			const managed = extractMetadata(benefit, "benefit");
			if (managed) {
				byManagedKey.set(managed.resource_key, benefit);
			}
		}
	}

	return { all, byManagedKey, byDescription };
}

export async function fetchAllProducts(
	polar: Polar,
): Promise<DiscoveredProducts> {
	const all = [];
	const byManagedKey = new Map();
	const byName = new Map();

	const response = await polar.products.list({ isArchived: false });
	for await (const page of response) {
		for (const product of page.result.items) {
			all.push(product);
			byName.set(product.name, product);
			const managed = extractMetadata(product, "product");
			if (managed) {
				byManagedKey.set(managed.resource_key, product);
			}
		}
	}

	return { all, byManagedKey, byName };
}
