import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	dts: true,
	entry: ["./lib/actions/index.ts", "./lib/middlewares/index.ts", "./lib/rate-limiter/index.ts"],
	format: ["esm"],
	minify: false,
	sourcemap: true,
	treeshake: true,
});
