import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	entry: [
		"./lib/index.ts",
		"./lib/admin.ts",
		"./lib/download.ts",
		"./lib/errors.ts",
		"./lib/images.config.ts",
	],
	format: ["esm"],
	minify: false,
	sourcemap: true,
	treeshake: true,
});
