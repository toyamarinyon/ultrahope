import type { createApiClient, EntitlementResponse } from "./api-client";
import type { AuthKind } from "./auth";
import {
	isEntitlementCacheFresh,
	readEntitlementCache,
	writeEntitlementCache,
} from "./entitlement-cache";

export type EntitlementCapability = {
	escalate: boolean;
};

export async function resolveEntitlementCapability(
	api: ReturnType<typeof createApiClient>,
	authKind: AuthKind,
): Promise<EntitlementCapability> {
	if (authKind !== "authenticated") {
		return { escalate: false };
	}

	const cache = await readEntitlementCache();
	if (cache && isEntitlementCacheFresh(cache)) {
		return {
			escalate: cache.entitlement === "pro",
		};
	}

	const capability = { escalate: true };
	void (async () => {
		try {
			const response: EntitlementResponse = await api.getEntitlement();
			capability.escalate = response.entitlement === "pro";
			await writeEntitlementCache(response.entitlement);
		} catch {
			// Keep optimistic state unchanged if entitlement check fails.
		}
	})();

	return capability;
}
