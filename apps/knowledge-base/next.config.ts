import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig as Config } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * File extensions and import attributes are necessary for node.js native typescript resolution with
 * `--experimental-next-config-strip-types` next.js cli option.
 */
import { env } from "./config/env.config.ts";

const config: Config = {
	allowedDevOrigins: ["127.0.0.1"],
	// cacheComponents: true,
	/** Compression should be handled by the reverse proxy. */
	compress: false,
	experimental: {
		authInterrupts: true,
		globalNotFound: true,
		rootParams: true,
		serverActions: {
			/**
			 * Must be larger than `imageSizeLimit` in `config/assets.config.ts` to allow multipart
			 * form-data overhead.
			 */
			bodySizeLimit: "8mb",
		},
		turbopackFileSystemCacheForDev: true,
		viewTransition: true,
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
			/** @see {@link https://github.com/vercel/next.js/discussions/77721#discussioncomment-14576268} */
			"*": {
				condition: {
					all: [
						"foreign",
						"browser",
						{
							path: /(@react-stately|@react-aria|@react-spectrum|react-aria-components)\/.*\/[a-z]{2}-[A-Z]{2}/,
						},
					],
				},
				loaders: ["null-loader"],
				as: "*.js",
			},
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
			extract: {
				sourceLocale: "en",
			},
			messages: {
				format: "po",
				locales: "infer",
				path: "./messages",
				precompile: true,
			},
			// The app imports the published ui bundle, so the extractor needs to scan it too.
			srcPath: ["./app", "./components", "./lib", "../../packages/ui/lib"],
		},
		requestConfig: "./lib/i18n/request.ts",
	}),
	function createSentryPlugin(config) {
		return withSentryConfig(config, {
			org: env.NEXT_PUBLIC_APP_SENTRY_ORG,
			project: env.NEXT_PUBLIC_APP_SENTRY_PROJECT,
			silent: env.CI !== true,
			/** Route browser requests to `sentry` through a `next.js` rewrite to circumvent ad-blockers. */
			tunnelRoute: "/monitoring",
			webpack: {
				reactComponentAnnotation: {
					enabled: true,
				},
				treeshake: {
					removeDebugLogging: true,
				},
			},
			widenClientFileUpload: true,
		});
	},
];

export default plugins.reduce((config, plugin) => plugin(config), config);
