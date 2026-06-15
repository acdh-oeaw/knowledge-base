import { defineConfig } from "tsdown";

export default defineConfig({
	clean: true,
	copy: ["./messages/", "./styles/"],
	dts: true,
	entry: [
		"./lib/**/*.ts",
		"./lib/**/*.tsx",
		"!./lib/**/*.stories.ts",
		"!./lib/**/*.stories.tsx",
		"!./lib/**/*.test.ts",
		"!./lib/**/*.test.tsx",
	],
	format: ["esm"],
	minify: false,
	sourcemap: true,
	treeshake: true,
	unbundle: true,
});
