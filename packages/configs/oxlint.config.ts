import base from "@acdh-knowledge-base/configs/oxlint/base";
import turbo from "@acdh-knowledge-base/configs/oxlint/turbo";
import { defineConfig } from "oxlint";

const config = defineConfig({
	extends: [base, turbo],
	options: {
		reportUnusedDisableDirectives: "error",
		typeAware: true,
		typeCheck: true,
	},
	rules: {
		"import/no-default-export": "off",
	},
});

export default config;
