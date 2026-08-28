import { defineConfig } from "vitest/config";

const config = defineConfig({
	test: {
		include: ["lib/**/*.test.ts"],
	},
});

export default config;
