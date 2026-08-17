import base from "@dariah-eric/configs/oxfmt/base";
import { defineConfig } from "oxfmt";

const config = defineConfig({
	...base,
	ignorePatterns: [
		"**/messages/*.json",
		"pnpm-workspace.yaml",
		"apps/*/content/",
		"apps/*/e2e/snapshots/",
		"apps/*/public/",
		"packages/database/db/migrations/",
		"turbo/generators/**/*.hbs",
	],
});

export default config;
