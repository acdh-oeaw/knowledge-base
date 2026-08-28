import { optimizeReactAriaLocales } from "@dariah-eric/configs/nextjs/react-aria-optimize-locales";
import type { NextConfig as Config } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * File extensions and import attributes are necessary for node.js native typescript resolution with
 * `--experimental-next-config-strip-types` next.js cli option.
 */
import { env } from "./config/env.config.ts";
import { languages } from "./lib/i18n/locales.ts";

const localeOptimization = optimizeReactAriaLocales([
	{ condition: "browser", locales: [] },
	{ condition: { not: "browser" }, locales: languages },
]);

const config: Config = {
	allowedDevOrigins: ["127.0.0.1"],
	// cacheComponents: true,
	/** Compression should be handled by the reverse proxy. */
	compress: false,
	experimental: {
		authInterrupts: true,
		globalNotFound: true,
		serverActions: {
			/**
			 * Must be larger than `imageSizeLimit` in `config/assets.config.ts` to allow multipart
			 * form-data overhead.
			 */
			bodySizeLimit: "24mb",
		},
		// turbopackRustReactCompiler: true,
	},
	headers() {
		const headers: Awaited<ReturnType<NonNullable<Config["headers"]>>> = [
			/** @see {@link https://nextjs.org/docs/app/guides/self-hosting#streaming-and-suspense} */
			{ source: "/:path*{/}?", headers: [{ key: "x-accel-buffering", value: "no" }] },
		];

		return headers;
	},
	images: {
		remotePatterns: [{ hostname: "imgproxy.acdh.oeaw.ac.at" }],
	},
	logging: {
		browserToTerminal: true,
		fetches: {
			fullUrl: true,
		},
	},
	output: env.BUILD_MODE,
	outputFileTracingIncludes: {
		"/api/reporting/**/*": ["./node_modules/pdfkit/js/data/*.afm"],
	},
	reactCompiler: true,
	/** @see {@link https://github.com/foliojs/pdfkit/issues/1549} */
	serverExternalPackages: ["pdfkit"],
	turbopack: {
		rules: {
			"*.css": {
				loaders: ["@tailwindcss/turbopack"],
				as: "*.css",
			},
			...localeOptimization.rules,
		},
	},
	// typedRoutes: true,
	typescript: {
		ignoreBuildErrors: true,
	},
};

const plugins: Array<(config: Config) => Config> = [
	createNextIntlPlugin({
		experimental: {
			/** @see {@link https://next-intl.dev/docs/workflows/typescript#messages-arguments} */
			createMessagesDeclaration: ["./messages/metadata/en/index.json"],
			extract: true,
			messages: {
				format: "po",
				locales: "infer",
				path: "./messages",
				precompile: true,
				sourceLocale: "en",
			},
			// The app imports the published ui bundle, so the extractor needs to scan it too.
			srcPath: ["./app", "./components", "./lib", "../../packages/ui/lib"],
		},
		requestConfig: "./lib/i18n/request.ts",
	}),
];

export default plugins.reduce((config, plugin) => plugin(config), config);
