import tsConfigPathsPlugin from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const config = defineConfig({
	plugins: [tsConfigPathsPlugin()],
	test: {
		include: ["test/**/*.test.ts"],
	},
});

export default config;
