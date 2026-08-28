import { defineConfig } from "vitest/config";

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		include: ["test/**/*.test.ts"],
	},
});

export default config;
