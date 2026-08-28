import * as path from "node:path";

import base from "@dariah-eric/configs/oxlint/base";
import drizzle from "@dariah-eric/configs/oxlint/drizzle";
import nextjs from "@dariah-eric/configs/oxlint/nextjs";
import playwright from "@dariah-eric/configs/oxlint/playwright";
import react from "@dariah-eric/configs/oxlint/react";
import regexp from "@dariah-eric/configs/oxlint/regexp";
import tailwindcss from "@dariah-eric/configs/oxlint/tailwindcss";
import turbo from "@dariah-eric/configs/oxlint/turbo";
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
