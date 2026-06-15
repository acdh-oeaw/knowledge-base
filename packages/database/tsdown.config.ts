import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	entry: [
		"./lib/index.ts",
		"./lib/client.ts",
		"./lib/errors.ts",
		"./lib/relations.ts",
		"./lib/schema.ts",
		"./lib/sql.ts",
	],
	format: ["esm"],
	minify: false,
	sourcemap: true,
	treeshake: true,
});
