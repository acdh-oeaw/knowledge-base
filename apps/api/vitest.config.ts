import tsConfigPathsPlugin from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

const config = defineConfig({
	plugins: [tsConfigPathsPlugin()],
});

export default config;
