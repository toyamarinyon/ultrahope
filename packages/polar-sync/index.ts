import { main } from "./src/polar-sync";

if (import.meta.main) {
	main().catch((error) => {
		console.error("\nSync failed:", error);
		process.exit(1);
	});
}
