import * as path from "node:path";

import base from "@dariah-eric/configs/oxlint/base";
import react from "@dariah-eric/configs/oxlint/react";
import storybook from "@dariah-eric/configs/oxlint/storybook";
import tailwindcss from "@dariah-eric/configs/oxlint/tailwindcss";
import turbo from "@dariah-eric/configs/oxlint/turbo";
import vitest from "@dariah-eric/configs/oxlint/vitest";
import { defineConfig } from "oxlint";

const configs = [base, react, storybook, turbo, vitest];

/**
 * Avoid issues with synckit in github actions.
 *
 * @see {@link https://github.com/schoero/eslint-plugin-better-tailwindcss/issues/261}
 * @see {@link https://github.com/schoero/eslint-plugin-better-tailwindcss/issues/341}
 */
// oxlint-disable-next-line node/no-process-env
if (process.env.CI == null) {
	// oxlint-disable-next-line typescript/no-explicit-any typescript/no-unsafe-argument
	configs.push(tailwindcss as any);
}

const config = defineConfig({
	extends: configs,
	options: {
		reportUnusedDisableDirectives: "error",
		typeAware: true,
		typeCheck: true,
	},
	settings: {
		"better-tailwindcss": {
			cwd: import.meta.dirname,
			entryPoint: path.join(import.meta.dirname, "./styles/index.css"),
		},
	},
});

export default config;
