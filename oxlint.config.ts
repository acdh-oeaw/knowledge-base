import base from "@dariah-eric/configs/oxlint/base";
import turbo from "@dariah-eric/configs/oxlint/turbo";
import { defineConfig } from "oxlint";

const config = defineConfig({
	extends: [base, turbo],
	options: {
		reportUnusedDisableDirectives: "error",
		typeAware: true,
		typeCheck: true,
	},
});

export default config;
