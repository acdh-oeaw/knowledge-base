import { log } from "@acdh-oeaw/lib";
import { unstable_extractMessages as extractMessages } from "next-intl/extractor";

async function main() {
	await extractMessages({
		messages: {
			format: "po",
			locales: "infer",
			path: "./messages",
		},
		sourceLocale: "en",
		// Include the published ui bundle so app-owned extraction stays in sync with shared components.
		srcPath: ["./app", "./components", "./lib", "../../packages/ui/lib"],
	});

	log.success("Successfully extracted i18n messages.");
}

main().catch((error: unknown) => {
	log.error("Failed to extract i18n messages.\n", error);
});
