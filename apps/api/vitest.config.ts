import isCI from "is-in-ci";
import { defineConfig } from "vitest/config";

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		maxWorkers: isCI ? 2 : undefined,
		testTimeout: 15_000,
	},
});

export default config;
