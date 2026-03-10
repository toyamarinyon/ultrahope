import { writeFile } from "node:fs/promises";
import openapiJson from "@ultrahope/web/openapi.json" with { type: "json" };
import openapiTS, { astToString, type OpenAPI3 } from "openapi-typescript";

const ast = await openapiTS(openapiJson as unknown as OpenAPI3);
const contents = astToString(ast);

const outPath = new URL("../lib/api-client.generated.ts", import.meta.url);
await writeFile(outPath, contents, "utf8");

console.log(`Generated API client types at ${outPath.pathname}`);
