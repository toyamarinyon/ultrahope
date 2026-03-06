/**
 * Idempotent Polar.sh configuration sync script.
 *
 * This script manages Meters, Benefits, and Products in Polar.sh.
 * It computes a concrete execution plan from desired state first, then either
 * renders it (dry-run) or applies it.
 *
 * Usage:
 *   # Production (default)
 *   mise exec --env production -- bun run polar-sync
 *
 *   # Sandbox
 *   mise exec --env sandbox -- bun run polar-sync --server sandbox --recreate
 *
 *   # Dry-run (show what would be done without prompting)
 *   bun run polar-sync --dry-run
 *
 *   # Skip confirmation prompt
 *   bun run polar-sync --yes
 *
 * Flags:
 *   --config <path>                Config TOML path (default: polar.toml)
 *   --server <production|sandbox>  Target server (default: production)
 *   --recreate                     Archive and recreate products when a price change cannot be updated in place
 *
 * Environment:
 *   POLAR_SYNC_ACCESS_TOKEN - Organization Access Token with required scopes
 *
 * Required OAT scopes:
 *   - meters:read, meters:write
 *   - benefits:read, benefits:write
 *   - products:read, products:write
 */

import { Polar } from "@polar-sh/sdk";
import { applyPlan } from "./apply";
import { loadConfig, resolveConfigPath } from "./config";
import { fetchAllBenefits, fetchAllMeters, fetchAllProducts } from "./discover";
import { printEnvironmentVariables, renderPlan } from "./output";
import { buildPlan } from "./plan";
import { buildResolvedResourceMaps } from "./resolution";
import type { ApplyState, DiscoveredState, PolarServer } from "./types";

async function prompt(message: string): Promise<boolean> {
	process.stdout.write(`${message} [y/N] `);
	const response = await new Promise<string>((resolve) => {
		const stdin = process.stdin;
		stdin.setEncoding("utf8");
		stdin.once("data", (data) => {
			resolve(data.toString().trim().toLowerCase());
		});
	});
	return response === "y" || response === "yes";
}

export async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const autoConfirm = args.includes("--yes") || args.includes("-y");
	const recreate = args.includes("--recreate");

	const serverIndex = args.indexOf("--server");
	const server: PolarServer =
		serverIndex !== -1 && args[serverIndex + 1] === "sandbox"
			? "sandbox"
			: "production";

	const flags = [dryRun && "dry-run", recreate && "recreate"]
		.filter(Boolean)
		.join(", ");
	console.log(`Polar Sync - ${server}${flags ? ` (${flags})` : ""}`);
	console.log("=".repeat(50));

	const configPath = resolveConfigPath(args);
	const config = loadConfig(configPath);
	console.log(`Config: ${configPath}`);

	const accessToken = process.env.POLAR_SYNC_ACCESS_TOKEN;
	if (!accessToken) {
		console.error("Error: POLAR_SYNC_ACCESS_TOKEN is not set");
		process.exit(1);
	}

	const polar = new Polar({ accessToken, server });

	console.log("\nFetching existing resources...");
	const [meters, benefits, products] = await Promise.all([
		fetchAllMeters(polar),
		fetchAllBenefits(polar),
		fetchAllProducts(polar),
	]);
	console.log(
		`  Found ${meters.all.length} meters, ${benefits.all.length} benefits, ${products.all.length} products`,
	);

	const discovered: DiscoveredState = {
		meters,
		benefits,
		products,
	};
	const plan = buildPlan(config, discovered, { recreate });
	const resolved = buildResolvedResourceMaps(config, discovered);

	renderPlan(plan);

	if (dryRun) {
		console.log(`\n${"=".repeat(50)}`);
		console.log("Dry-run complete. No changes were made.");
		return;
	}

	console.log("");
	const confirmed = autoConfirm || (await prompt("Apply these changes?"));
	if (!confirmed) {
		console.log("Aborted.");
		process.exit(0);
	}

	const state: ApplyState = {
		polar,
		meters: new Map(resolved.meters),
		benefits: new Map(resolved.benefits),
		products: new Map(resolved.products),
	};

	await applyPlan(plan, state);

	console.log(`\n${"=".repeat(50)}`);
	console.log("Sync complete!");
	printEnvironmentVariables(config, state.products, state.meters);

	process.exit(0);
}
