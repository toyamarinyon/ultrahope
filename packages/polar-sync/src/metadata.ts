import type { ManagedMetadata, SyncResourceKind } from "./types";

const MANAGED_BY = "ultrahope";

export function buildManagedMetadata(
	kind: SyncResourceKind,
	key: string,
): ManagedMetadata {
	return {
		managed_by: MANAGED_BY,
		resource_kind: kind,
		resource_key: key,
	};
}

export function extractMetadata(
	resource: { metadata?: unknown },
	kind: SyncResourceKind,
): ManagedMetadata | null {
	const metadata = resource.metadata;
	if (!metadata || typeof metadata !== "object") return null;

	const record = metadata as Partial<Record<string, unknown>>;
	const managedBy = record.managed_by;
	const resourceKind = record.resource_kind;
	const resourceKey = record.resource_key;

	if (
		managedBy !== MANAGED_BY ||
		typeof resourceKind !== "string" ||
		typeof resourceKey !== "string" ||
		resourceKind !== kind
	) {
		return null;
	}

	return {
		managed_by: MANAGED_BY,
		resource_kind: kind,
		resource_key: resourceKey,
	};
}

export function withManagedMetadata<T extends Record<string, unknown>>(
	kind: SyncResourceKind,
	key: string,
	payload: T,
): T & { metadata: ManagedMetadata } {
	return {
		...payload,
		metadata: buildManagedMetadata(kind, key),
	};
}

export function isManaged(
	resource: { metadata?: unknown },
	kind: SyncResourceKind,
): boolean {
	return extractMetadata(resource, kind) !== null;
}
