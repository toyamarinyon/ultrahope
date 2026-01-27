import { writeFile } from "node:fs/promises";

const origin = process.env.ULTRAHOPE_API_ORIGIN ?? "http://localhost:3100";
const url = new URL("/api/openapi/json", origin);

const res = await fetch(url);
if (!res.ok) {
	const text = await res.text();
	throw new Error(`Failed to fetch OpenAPI spec: ${res.status} ${text}`);
}

const spec = await res.json();
const outPath = new URL("../openapi.json", import.meta.url);
await writeFile(outPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");

console.log(`Saved OpenAPI spec to ${outPath.pathname}`);
