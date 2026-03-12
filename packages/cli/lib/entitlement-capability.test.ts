import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getEntitlementCacheTtlMs,
	readEntitlementCache,
} from "./entitlement-cache";
import { resolveEntitlementCapability } from "./entitlement-capability";

type EntitlementClient = Parameters<typeof resolveEntitlementCapability>[0];

type EntitlementResponse = {
	entitlement: "anonymous" | "authenticated_unpaid" | "pro";
};

function createApiClientMock(entitlement: EntitlementResponse["entitlement"]) {
	let callCount = 0;
	const api = {
		async getEntitlement() {
			callCount += 1;
			return { entitlement } satisfies EntitlementResponse;
		},
		getCallCount() {
			return callCount;
		},
	};

	return api as EntitlementClient & { getCallCount: () => number };
}

function waitForBackgroundRefresh(): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
}

function resolveTimestampOffset(offsetMs: number): string {
	return new Date(Date.now() - offsetMs).toISOString();
}

describe("resolveEntitlementCapability", () => {
	let originalXdg: string | undefined;
	let workspace: string;

	beforeEach(() => {
		originalXdg = process.env.XDG_CONFIG_HOME;
		workspace = mkdtempSync(join(tmpdir(), "ultrahope-entitlement-"));
		process.env.XDG_CONFIG_HOME = workspace;
	});

	afterEach(async () => {
		await fs.rm(workspace, { recursive: true, force: true });
		if (originalXdg === undefined) {
			delete process.env.XDG_CONFIG_HOME;
		} else {
			process.env.XDG_CONFIG_HOME = originalXdg;
		}
	});

	it("uses fresh pro cache to enable escalation", async () => {
		await fs.mkdir(join(workspace, "ultrahope"), { recursive: true });
		await fs.writeFile(
			join(workspace, "ultrahope", "entitlement-cache.json"),
			JSON.stringify({
				entitlement: "pro",
				fetchedAt: resolveTimestampOffset(0),
			}),
			"utf-8",
		);

		const api = createApiClientMock("authenticated_unpaid");
		const capability = await resolveEntitlementCapability(api, "authenticated");

		expect(capability).toEqual({ escalate: true });
		expect(api.getCallCount()).toBe(0);
	});

	it("uses fresh authenticated_unpaid cache to disable escalation", async () => {
		await fs.mkdir(join(workspace, "ultrahope"), { recursive: true });
		await fs.writeFile(
			join(workspace, "ultrahope", "entitlement-cache.json"),
			JSON.stringify({
				entitlement: "authenticated_unpaid",
				fetchedAt: resolveTimestampOffset(0),
			}),
			"utf-8",
		);

		const api = createApiClientMock("pro");
		const capability = await resolveEntitlementCapability(api, "authenticated");

		expect(capability).toEqual({ escalate: false });
		expect(api.getCallCount()).toBe(0);
	});

	it("refreshes stale cache in background", async () => {
		await fs.mkdir(join(workspace, "ultrahope"), { recursive: true });
		await fs.writeFile(
			join(workspace, "ultrahope", "entitlement-cache.json"),
			JSON.stringify({
				entitlement: "pro",
				fetchedAt: resolveTimestampOffset(getEntitlementCacheTtlMs() + 1000),
			}),
			"utf-8",
		);

		const api = createApiClientMock("authenticated_unpaid");
		const capability = await resolveEntitlementCapability(api, "authenticated");
		expect(capability).toEqual({ escalate: true });
		expect(api.getCallCount()).toBe(0);

		await waitForBackgroundRefresh();
		expect(api.getCallCount()).toBe(1);
		expect(capability).toEqual({ escalate: false });

		const updated = await readEntitlementCache();
		expect(updated?.entitlement).toBe("authenticated_unpaid");
	});

	it("hides escalation for anonymous users", async () => {
		const api = createApiClientMock("pro");
		const capability = await resolveEntitlementCapability(api, "anonymous");

		expect(capability).toEqual({ escalate: false });
		expect(api.getCallCount()).toBe(0);
	});
});
