import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	entry: ["./lib/index.ts", "./lib/admin.ts", "./lib/errors.ts"],
	format: ["esm"],
	minify: false,
	sourcemap: true,
	treeshake: true,
});
