import * as path from "node:path";

import base from "@acdh-knowledge-base/configs/oxlint/base";
import drizzle from "@acdh-knowledge-base/configs/oxlint/drizzle";
import nextjs from "@acdh-knowledge-base/configs/oxlint/nextjs";
import playwright from "@acdh-knowledge-base/configs/oxlint/playwright";
import react from "@acdh-knowledge-base/configs/oxlint/react";
import regexp from "@acdh-knowledge-base/configs/oxlint/regexp";
import tailwindcss from "@acdh-knowledge-base/configs/oxlint/tailwindcss";
import turbo from "@acdh-knowledge-base/configs/oxlint/turbo";
import { defineConfig } from "oxlint";

const configs = [base, drizzle, nextjs, playwright, react, regexp, turbo];

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
	rules: {
		"no-restricted-imports": ["error", { patterns: [{ group: ["./*", "../*"] }] }],
	},
	settings: {
		"better-tailwindcss": {
			cwd: import.meta.dirname,
			entryPoint: path.join(import.meta.dirname, "./styles/index.css"),
		},
	},
});

export default config;
