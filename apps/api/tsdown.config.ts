import { defineConfig } from "tsdown";

const config = defineConfig({
	clean: true,
	dts: false,
	format: ["esm"],
	minify: true,
	sourcemap: true,
	treeshake: true,
});

export default config;
