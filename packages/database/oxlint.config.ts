import base from "@dariah-eric/configs/oxlint/base";
import drizzle from "@dariah-eric/configs/oxlint/drizzle";
import turbo from "@dariah-eric/configs/oxlint/turbo";
import { defineConfig } from "oxlint";

const config = defineConfig({
	extends: [base, drizzle, turbo],
	options: {
		reportUnusedDisableDirectives: "error",
		typeAware: true,
		typeCheck: true,
	},
});

export default config;
