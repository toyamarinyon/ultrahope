import { writeFile } from "node:fs/promises";

import { app } from "../lib/api";

async function main() {
	const res = await app.handle(new Request("http://internal/api/openapi/json"));

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${text}`);
	}

	const spec = await res.json();
	const json = `${JSON.stringify(spec, null, 2)}\n`;

	const jsonPath = new URL("../openapi.json", import.meta.url);
	await writeFile(jsonPath, json, "utf8");

	// YAML 1.2 accepts JSON as a subset, so this is a valid YAML file.
	const yamlPath = new URL("../openapi.yaml", import.meta.url);
	await writeFile(yamlPath, json, "utf8");

	console.log(
		`Saved OpenAPI spec to ${jsonPath.pathname} and ${yamlPath.pathname}`,
	);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
