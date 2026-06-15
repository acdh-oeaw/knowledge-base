import base from "@acdh-knowledge-base/configs/oxlint/base";
import drizzle from "@acdh-knowledge-base/configs/oxlint/drizzle";
import turbo from "@acdh-knowledge-base/configs/oxlint/turbo";
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
