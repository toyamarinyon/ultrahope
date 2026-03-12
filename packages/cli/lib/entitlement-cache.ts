import fs from "node:fs/promises";
import * as os from "node:os";
import path from "node:path";

export type EntitlementStatus = "anonymous" | "authenticated_unpaid" | "pro";

export interface EntitlementCacheRecord {
	entitlement: EntitlementStatus;
	fetchedAt: string;
}

const ENTITLEMENT_CACHE_TTL_MS = 1000 * 60 * 15;

function getEntitlementCachePath(): string {
	const configDir =
		process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
	const filename = "entitlement-cache.json";
	return path.join(configDir, "ultrahope", filename);
}

export function getEntitlementCacheTtlMs(): number {
	return ENTITLEMENT_CACHE_TTL_MS;
}

export async function readEntitlementCache(): Promise<EntitlementCacheRecord | null> {
	const cachePath = getEntitlementCachePath();
	try {
		const raw = await fs.readFile(cachePath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (
			parsed &&
			typeof parsed === "object" &&
			"entitlement" in parsed &&
			"fetchedAt" in parsed &&
			typeof parsed.entitlement === "string" &&
			typeof parsed.fetchedAt === "string"
		) {
			if (
				parsed.entitlement === "anonymous" ||
				parsed.entitlement === "authenticated_unpaid" ||
				parsed.entitlement === "pro"
			) {
				return {
					entitlement: parsed.entitlement,
					fetchedAt: parsed.fetchedAt,
				};
			}
		}
		return null;
	} catch {
		return null;
	}
}

function normalizeCachedAt(fetchedAt: string): number {
	const value = Date.parse(fetchedAt);
	return Number.isFinite(value) ? value : NaN;
}

export function isEntitlementCacheFresh(
	record: EntitlementCacheRecord,
): boolean {
	const fetchedAt = normalizeCachedAt(record.fetchedAt);
	if (!Number.isFinite(fetchedAt)) return false;
	return Date.now() - fetchedAt <= ENTITLEMENT_CACHE_TTL_MS;
}

export async function writeEntitlementCache(
	entitlement: EntitlementStatus,
): Promise<void> {
	const cachePath = getEntitlementCachePath();
	const dir = path.dirname(cachePath);
	await fs.mkdir(dir, { recursive: true });
	const payload: EntitlementCacheRecord = {
		entitlement,
		fetchedAt: new Date().toISOString(),
	};
	await fs.writeFile(cachePath, JSON.stringify(payload), { mode: 0o600 });
}
