import { defineConfig } from "tsup";

export default defineConfig({
	entry: [
		"./halo.ts",
		"./ultrahope.ts",
		"./git-halo.ts",
		"./git-ultrahope.ts",
		"./git-hope.ts",
		"./git-uh.ts",
	],
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
