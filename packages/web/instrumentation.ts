export async function register() {
	if (process.env.MOCKING === "1") {
		console.log("\n[MOCKING] Mocking mode enabled:");
		console.log("  - Daily limit check bypassed for free users");
		console.log("  - Using mocking model for translations\n");
	}
	if (
		process.env.NODE_ENV !== "production" &&
		process.env.SKIP_DAILY_LIMIT_CHECK === "1"
	) {
		console.log("\n[SKIP_DAILY_LIMIT_CHECK] Daily limit check bypassed\n");
	}
}
