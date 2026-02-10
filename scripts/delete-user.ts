import { spawn } from "node:child_process";

const child = spawn(
	"bun",
	["--cwd", "packages/web", "scripts/delete-user.ts", ...process.argv.slice(2)],
	{
		stdio: "inherit",
		env: process.env,
	},
);

child.on("error", (error) => {
	console.error(`[delete-user] failed to start runner: ${error.message}`);
	process.exitCode = 1;
});

child.on("exit", (code, signal) => {
	if (signal) {
		console.error(`[delete-user] runner exited with signal: ${signal}`);
		process.exitCode = 1;
		return;
	}
	process.exitCode = code ?? 1;
});
