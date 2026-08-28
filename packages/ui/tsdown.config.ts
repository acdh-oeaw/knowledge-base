import { extname, resolve as resolvePath, sep } from "node:path";

import extractionLoader from "next-intl/extractor/extractionLoader";
import { type TsdownPlugin, defineConfig } from "tsdown";

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const packageRoot = import.meta.dirname;
/** Only this package's own sources — a dependency merely mentioning `useExtracted` is not ours. */
const sourceRoot = resolvePath(packageRoot, "lib") + sep;

/**
 * Runs next-intl's message extraction transform over this package's sources.
 *
 * `useExtracted("ui")` is not a plain hook: the key an author writes is thrown away at runtime, and
 * a build-time transform is what rewrites `t("Bold")` into `t(<hash of "Bold">)` against the
 * catalogue in `./messages`. next-intl ships that transform as a Turbopack loader wired up by
 * `createNextIntlPlugin`, which only reaches files Next.js itself compiles.
 *
 * This package is compiled by tsdown and consumed as a published bundle, so the transform never ran
 * and every `t(...)` call shipped its source string where the catalogue is keyed by the hash. Each
 * lookup missed and next-intl rendered its fallback — the namespace name — so every translated
 * label in this package read "ui". Consuming apps cannot fix that for us: one of them does not even
 * run the extractor, and neither compiles our `dist`.
 *
 * The loader has a webpack-shaped interface, so it is driven here with the parts of that context it
 * actually reads.
 */
function nextIntlExtraction(): TsdownPlugin {
	return {
		name: "next-intl-extraction",

		transform(code: string, id: string) {
			if (
				!id.startsWith(sourceRoot) ||
				!sourceExtensions.has(extname(id)) ||
				!code.includes("useExtracted")
			) {
				return null;
			}

			return new Promise((resolve, reject) => {
				const context = {
					async() {
						return (error: Error | null, transformed?: string, map?: string) => {
							if (error != null) {
								reject(error);
								return;
							}

							resolve({ code: transformed!, map });
						};
					},
					resourcePath: id,
					rootContext: packageRoot,
					sourceMap: true,
				};

				(extractionLoader as (this: typeof context, source: string) => void).call(context, code);
			});
		},
	};
}

export default defineConfig({
	clean: true,
	copy: ["./messages/", "./styles/"],
	dts: true,
	entry: [
		"./lib/**/*.ts",
		"./lib/**/*.tsx",
		"!./lib/**/*.stories.ts",
		"!./lib/**/*.stories.tsx",
		"!./lib/**/*.test.ts",
		"!./lib/**/*.test.tsx",
	],
	format: ["esm"],
	minify: false,
	plugins: [nextIntlExtraction()],
	sourcemap: true,
	treeshake: true,
	unbundle: true,
});
