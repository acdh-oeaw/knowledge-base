import { join } from "node:path";

import { isNonEmptyString } from "@acdh-oeaw/lib";
import { config as dotenv } from "@dotenvx/dotenvx";
import { type PlaywrightTestConfig, defineConfig, devices } from "@playwright/test";
import isCI from "is-in-ci";

import { impersonationAdmin } from "./lib/fixtures/impersonation";

/**
 * Reading `.env` files here instead of using `dotenvx run` so environment variables are available
 * to the vs code plugin as well.
 */
dotenv({
	path: [".env.test.local", ".env.local", ".env.test", ".env"].map((filePath) =>
		join(import.meta.dirname, "..", filePath),
	),
	ignore: ["MISSING_ENV_FILE"],
	quiet: true,
});

/** Playwright does not export the single web server config type, so we derive it. */
type WebServer = Extract<NonNullable<PlaywrightTestConfig["webServer"]>, { command: string }>;

/**
 * Tests under these directories require a specific authenticated storage state and run in their own
 * projects (`admin`, `non-admin`, `nc`, `wgchair`, `reporter`, `impersonation`). The cross-browser
 * projects must ignore them so they only run once, under the matching identity.
 */
const authenticatedProjectGlobs = [
	"**/admin/**/*.test.ts",
	"**/non-admin/**/*.test.ts",
	"**/nc/**/*.test.ts",
	"**/wgchair/**/*.test.ts",
	"**/reporter/**/*.test.ts",
	"**/impersonation/**/*.test.ts",
];

function getConfig():
	| { kind: "remote"; baseUrl: string; webServer: undefined }
	| { kind: "local"; baseUrl: string; webServer: WebServer } {
	// oxlint-disable-next-line node/no-process-env
	const remoteBaseUrl = process.env.PLAYWRIGHT_TEST_APP_BASE_URL;

	if (isNonEmptyString(remoteBaseUrl)) {
		return {
			kind: "remote",
			baseUrl: remoteBaseUrl,
			webServer: undefined,
		};
	}

	// oxlint-disable-next-line node/no-process-env
	const port = Number(process.env.PORT) || 3001;
	const baseUrl = `http://localhost:${String(port)}`;

	return {
		kind: "local",
		baseUrl,
		webServer: {
			command: `pnpm run --filter "@dariah-eric/knowledge-base" start --port ${String(port)}`,
			url: baseUrl,
			reuseExistingServer: !isCI,
			env: {
				/**
				 * Enables the `x-e2e-force-failure` test header in createServerAction. The header itself is
				 * only honored when this flag is set on the server.
				 */
				E2E_FAILURE_INJECTION: "1",
				/**
				 * Run the server in a deliberately non-UTC timezone (a +05:30 half-hour offset, no DST) so
				 * any code that accidentally depends on the server's local time surfaces instead of being
				 * masked by a UTC CI host. Combined with the non-UTC _browser_ timezone some suites set
				 * (e.g. website-events-datetime uses America/Los_Angeles), this exercises the client↔server
				 * boundary from both sides. The app must stay timezone-independent: dates render via
				 * next-intl's global `timeZone: "UTC"`, are stored/read as UTC, and wall-clock inputs are
				 * parsed with an explicit `Z`. NOTE: with `reuseExistingServer` a stale local dev server
				 * won't pick this up — it takes effect on a fresh start (always in CI).
				 */
				TZ: "Asia/Kolkata",
			},
		},
	};
}

/**
 * Server actions dispatch revalidation webhooks via `after()`. The real endpoint is not available
 * during e2e tests, so we run a stand-in that answers with `204` to keep the server logs clean.
 */
function getWebhookMockServer(): WebServer | undefined {
	// oxlint-disable-next-line node/no-process-env
	const webhookUrl = process.env.REVALIDATION_WEBHOOK_URL;

	if (!isNonEmptyString(webhookUrl)) {
		return undefined;
	}

	const port = Number(new URL(webhookUrl).port) || 3002;

	return {
		command: `tsx ${join(import.meta.dirname, "lib/webhook-mock-server.ts")}`,
		port,
		reuseExistingServer: !isCI,
	};
}

const config = getConfig();

const webServers: Array<WebServer> = [];

if (config.kind === "local") {
	const webhookMockServer = getWebhookMockServer();
	if (webhookMockServer != null) {
		webServers.push(webhookMockServer);
	}
}

if (config.webServer != null) {
	webServers.push(config.webServer);
}

export default defineConfig({
	testDir: "../e2e",
	snapshotDir: "../e2e/snapshots",
	timeout: isCI ? 90_000 : 30_000,
	fullyParallel: true,
	forbidOnly: isCI,
	retries: isCI ? 1 : 0,
	maxFailures: 10,
	workers: isCI ? 2 : undefined,
	reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["html"]],
	globalSetup: "./lib/global-setup.ts",
	globalTeardown: "./lib/global-teardown.ts",
	use: {
		baseURL: config.baseUrl,
		navigationTimeout: isCI ? 60_000 : 30_000,
		screenshot: "on-first-failure",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			testIgnore: authenticatedProjectGlobs,
			use: { ...devices["Desktop Chrome"], channel: "chromium" },
		},
		{
			name: "firefox",
			testIgnore: authenticatedProjectGlobs,
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			testIgnore: authenticatedProjectGlobs,
			use: { ...devices["Desktop Safari"] },
		},
		{
			name: "admin",
			testMatch: "**/admin/**/*.test.ts",
			use: {
				...devices["Desktop Chrome"],
				storageState: join(import.meta.dirname, ".auth/admin.json"),
			},
		},
		{
			name: "non-admin",
			testMatch: "**/non-admin/**/*.test.ts",
			use: {
				...devices["Desktop Chrome"],
				storageState: join(import.meta.dirname, ".auth/non-admin.json"),
			},
		},
		/**
		 * A second admin, whose session exists so that impersonating on it cannot reach the `admin`
		 * project. Impersonation lives on the session row, so a suite that shared the `admin` session
		 * would turn every admin test running concurrently in the other worker non-admin for as long as
		 * the impersonation lasted. Kept in the same CI job as `admin` on purpose: running the two side
		 * by side is what would catch that regression coming back.
		 */
		{
			name: "impersonation",
			testMatch: "**/impersonation/**/*.test.ts",
			use: {
				...devices["Desktop Chrome"],
				storageState: join(import.meta.dirname, ".auth", impersonationAdmin.storageFile),
			},
		},
		/**
		 * Relation-derived reporting personas, authenticated via the storage states written in
		 * `global-setup` (see `seedReportingPersonas`). `nc` = national coordinator, `wgchair` =
		 * working-group chair, `reporter` = WG member + country coordination staff (edits, cannot
		 * confirm).
		 */
		{
			name: "nc",
			testMatch: "**/nc/**/*.test.ts",
			use: {
				...devices["Desktop Chrome"],
				storageState: join(import.meta.dirname, ".auth/nc.json"),
			},
		},
		{
			name: "wgchair",
			testMatch: "**/wgchair/**/*.test.ts",
			use: {
				...devices["Desktop Chrome"],
				storageState: join(import.meta.dirname, ".auth/wgchair.json"),
			},
		},
		{
			name: "reporter",
			testMatch: "**/reporter/**/*.test.ts",
			use: {
				...devices["Desktop Chrome"],
				storageState: join(import.meta.dirname, ".auth/reporter.json"),
			},
		},
		/** Test against mobile viewports. */
		// {
		//     name: "Mobile Chrome",
		//     use: { ...devices["Pixel 5"] },
		// },
		// {
		//     name: "Mobile Safari",
		//     use: { ...devices["iPhone 12"] },
		// },
		/** Test against branded browsers. */
		// {
		//     name: "Microsoft Edge",
		//     use: { ...devices["Desktop Edge"], channel: "msedge" },
		// },
		// {
		//     name: "Google Chrome",
		//     use: { ...devices["Desktop Chrome"], channel: "chrome" },
		// },
	],
	webServer: webServers,
});
