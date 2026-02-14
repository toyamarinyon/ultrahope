import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";

function findAvailablePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.listen(0, "127.0.0.1", () => {
			const addr = server.address();
			if (addr === null || typeof addr === "string") {
				server.close();
				reject(new Error("Failed to get port"));
				return;
			}
			const port = addr.port;
			server.close(() => resolve(port));
		});
		server.on("error", reject);
	});
}

const port = await findAvailablePort();
const root = resolve(import.meta.dirname, "..");
const miseTomlPath = resolve(root, ".mise.toml");

let miseContent: string;
try {
	miseContent = await readFile(miseTomlPath, "utf-8");
} catch {
	miseContent = "";
}

const envVars: Record<string, string> = {
	PORT: `${port}`,
	NEXT_PUBLIC_PORT: `${port}`,
	ULTRAHOPE_API_URL: `http://localhost:${port}`,
	ULTRAHOPE_ENV: "sandbox",
};

if (miseContent.includes("[env]")) {
	for (const [key, value] of Object.entries(envVars)) {
		const regex = new RegExp(`^${key}\\s*=.*$`, "m");
		if (regex.test(miseContent)) {
			miseContent = miseContent.replace(regex, `${key} = "${value}"`);
		} else {
			miseContent = miseContent.replace("[env]", `[env]\n${key} = "${value}"`);
		}
	}
} else {
	const envBlock = Object.entries(envVars)
		.map(([k, v]) => `${k} = "${v}"`)
		.join("\n");
	miseContent = `[env]\n${envBlock}\n\n${miseContent}`;
}

await writeFile(miseTomlPath, miseContent);
console.log(`Port ${port} configured in .mise.toml`);
