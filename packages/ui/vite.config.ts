/// <reference types="vitest/config" />

import * as path from "node:path";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcssPlugin from "@tailwindcss/vite";
import reactPlugin from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";
import tsConfigPathsPlugin from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [reactPlugin(), tailwindcssPlugin(), tsConfigPathsPlugin()],
	test: {
		projects: [
			{
				extends: true,
				plugins: [
					storybookTest({
						configDir: path.join(import.meta.dirname, ".storybook"),
					}),
				],
				test: {
					name: "storybook",
					browser: {
						enabled: true,
						headless: true,
						instances: [{ browser: "chromium" }],
						provider: playwright({}),
					},
					setupFiles: [path.join(import.meta.dirname, ".storybook/vitest.setup.ts")],
				},
			},
		],
	},
});
