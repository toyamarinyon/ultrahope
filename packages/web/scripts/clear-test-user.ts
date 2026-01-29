/**
 * Clear test user data from both Turso (SQLite) and Polar sandbox.
 *
 * Usage:
 *   pnpm -w exec tsx packages/web/scripts/clear-test-user.ts <email>
 *
 * Example:
 *   pnpm -w exec tsx packages/web/scripts/clear-test-user.ts test@example.com
 */

import { Polar } from "@polar-sh/sdk";
import { eq } from "drizzle-orm";
import { account, db, deviceCode, session, user } from "../db";

const email = process.argv[2];

if (!email) {
	console.error(
		"Usage: pnpm -w exec tsx packages/web/scripts/clear-test-user.ts <email>",
	);
	process.exit(1);
}

const polarClient = new Polar({
	accessToken: process.env.POLAR_ACCESS_TOKEN,
	server: "sandbox",
});

async function main() {
	console.log(`Looking for user with email: ${email}`);

	const targetUser = await db
		.select()
		.from(user)
		.where(eq(user.email, email))
		.get();

	if (!targetUser) {
		console.log("User not found in database");
		process.exit(0);
	}

	console.log(`Found user: ${targetUser.id} (${targetUser.name})`);

	// Delete from Turso (order matters due to foreign keys)
	console.log("\n[Turso] Deleting related data...");

	const deletedSessions = await db
		.delete(session)
		.where(eq(session.userId, targetUser.id))
		.returning();
	console.log(`  - Deleted ${deletedSessions.length} sessions`);

	const deletedAccounts = await db
		.delete(account)
		.where(eq(account.userId, targetUser.id))
		.returning();
	console.log(`  - Deleted ${deletedAccounts.length} accounts`);

	const deletedDeviceCodes = await db
		.delete(deviceCode)
		.where(eq(deviceCode.userId, targetUser.id))
		.returning();
	console.log(`  - Deleted ${deletedDeviceCodes.length} device codes`);

	const deletedUsers = await db
		.delete(user)
		.where(eq(user.id, targetUser.id))
		.returning();
	console.log(`  - Deleted ${deletedUsers.length} user`);

	// Delete from Polar sandbox
	console.log("\n[Polar] Deleting customer...");
	try {
		const customers = await polarClient.customers.list({
			email: email,
		});

		if (customers.result.items.length === 0) {
			console.log("  - Customer not found in Polar");
		} else {
			for (const customer of customers.result.items) {
				await polarClient.customers.delete({ id: customer.id });
				console.log(`  - Deleted customer: ${customer.id}`);
			}
		}
	} catch (error) {
		console.error("  - Failed to delete from Polar:", error);
	}

	console.log("\nDone!");
}

main().catch(console.error);
