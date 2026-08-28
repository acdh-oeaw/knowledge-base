/// <reference types="vitest/config" />

import * as path from "node:path";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import tailwindcssPlugin from "@tailwindcss/vite";
import reactPlugin from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [reactPlugin(), tailwindcssPlugin()],
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		projects: [
			{
				/**
				 * Plain node tests for the pure helpers behind the components — attribute normalization and
				 * the JSON serialization that carries block attributes through copy/paste. Nothing here
				 * renders, so it stays out of the browser project and its playwright dependency.
				 */
				extends: true,
				test: {
					name: "unit",
					environment: "node",
					include: [path.join(import.meta.dirname, "lib/**/*.test.ts")],
				},
			},
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
				},
			},
		],
	},
});
