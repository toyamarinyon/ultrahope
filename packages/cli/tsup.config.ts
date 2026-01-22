import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	platform: "node",
	target: "es2022",
	outDir: "dist",
	splitting: false,
	sourcemap: false,
	clean: true,
	minify: false,
	banner: {
		js: "#!/usr/bin/env node",
	},
});
