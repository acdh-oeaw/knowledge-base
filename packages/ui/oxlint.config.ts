import * as path from "node:path";

import base from "@acdh-knowledge-base/configs/oxlint/base";
import react from "@acdh-knowledge-base/configs/oxlint/react";
import storybook from "@acdh-knowledge-base/configs/oxlint/storybook";
import tailwindcss from "@acdh-knowledge-base/configs/oxlint/tailwindcss";
import turbo from "@acdh-knowledge-base/configs/oxlint/turbo";
import vitest from "@acdh-knowledge-base/configs/oxlint/vitest";
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
	configs.push(tailwindcss);
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
