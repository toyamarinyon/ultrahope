/**
 * Drain a user's Polar meter balance to 0 for testing.
 *
 * Usage:
 *   mise exec --env sandbox && bun --cwd packages/web scripts/drain-meter.ts <userId>
 *
 * Environment:
 *   POLAR_ACCESS_TOKEN          - Polar access token
 *   POLAR_SERVER                - "sandbox" or "production" (default: sandbox)
 *   POLAR_USAGE_COST_METER_ID   - Meter ID to drain
 *
 * Example:
 *   mise exec --env sandbox && bun --cwd packages/web scripts/drain-meter.ts 42
 */

import { Polar } from "@polar-sh/sdk";

const userId = process.argv[2];

if (!userId) {
	console.error(
		"Usage: pnpm -w exec tsx packages/web/scripts/drain-meter.ts <userId>",
	);
	process.exit(1);
}

const accessToken = process.env.POLAR_ACCESS_TOKEN;
if (!accessToken) {
	console.error("POLAR_ACCESS_TOKEN is not set");
	process.exit(1);
}

const meterId = process.env.POLAR_USAGE_COST_METER_ID;
if (!meterId) {
	console.error("POLAR_USAGE_COST_METER_ID is not set");
	process.exit(1);
}

const server =
	(process.env.POLAR_SERVER as "sandbox" | "production") ?? "sandbox";

const polarClient = new Polar({
	accessToken,
	server,
});

async function main() {
	console.log(`[polar] server=${server}, userId=${userId}, meterId=${meterId}`);

	// 1. Get current balance
	const meterResponse = await polarClient.customerMeters.list({
		externalCustomerId: userId,
		meterId,
		limit: 1,
	});

	const meters = meterResponse.result.items;
	if (meters.length === 0) {
		console.log("No meter found for this user. Nothing to drain.");
		process.exit(0);
	}

	const currentBalance = meters[0].balance;
	console.log(`Current balance: ${currentBalance}`);

	if (currentBalance <= 0) {
		console.log("Balance is already 0 or negative. Nothing to do.");
		process.exit(0);
	}

	// 2. Ingest a usage event with cost equal to the current balance
	console.log(
		`Ingesting usage event with cost=${currentBalance} to drain balance to 0...`,
	);

	await polarClient.events.ingest({
		events: [
			{
				name: "usage",
				externalCustomerId: userId,
				metadata: {
					cost: currentBalance,
					model: "drain-test",
					provider: "test",
					generationId: `drain-${Date.now()}`,
				},
			},
		],
	});

	// 3. Verify (may take a moment to propagate)
	console.log("Event ingested. Waiting 2s for propagation...");
	await new Promise((resolve) => setTimeout(resolve, 2000));

	const verifyResponse = await polarClient.customerMeters.list({
		externalCustomerId: userId,
		meterId,
		limit: 1,
	});

	const newBalance = verifyResponse.result.items[0]?.balance ?? "unknown";
	console.log(`New balance: ${newBalance}`);
	console.log("Done!");
}

main().catch((error) => {
	console.error("Failed:", error);
	process.exit(1);
});
