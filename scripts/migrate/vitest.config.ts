import { defineConfig } from "vitest/config";

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
});

export default config;
