import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import type { ConfigProps as RateLimiterConfig } from "hono-rate-limiter";

import { env } from "~/config/env.config";

/**
 * The caller a limit is counted against.
 *
 * `x-forwarded-for` is a comma-separated chain when more than one proxy is in front of the api, so
 * only its first entry identifies the client — keying on the whole string would give the same
 * client different buckets depending on the path its request took. When the header is absent
 * entirely the connection's own address is used, because falling back to a constant would put every
 * such caller in one shared bucket and let any of them exhaust it for all the others.
 */
function getClientKey(c: Context): string {
	const forwardedFor = c.req.header("x-forwarded-for");

	if (forwardedFor != null) {
		const [client] = forwardedFor.split(",");

		if (client != null && client.trim() !== "") {
			return client.trim();
		}
	}

	/**
	 * Only reachable when the node adapter is serving the request. Anything else — the test client
	 * calling `app.request()` directly, or another adapter — has no connection to read, and throwing
	 * here would surface far from the cause: this middleware runs before `logger()` in `factory.ts`,
	 * so the error handler would find no logger and report that instead.
	 */
	try {
		return getConnInfo(c).remote.address ?? "";
	} catch {
		return "";
	}
}

function hasAccessToken(c: Context): boolean {
	if (env.API_ACCESS_TOKEN == null) {
		return false;
	}

	return c.req.header("x-api-access-token") === env.API_ACCESS_TOKEN;
}

/**
 * Asset routes are excluded and limited separately (see {@link assetConfig}).
 *
 * Every other route is fetched by the website's server, which carries the access token and skips
 * the limit entirely; what remains on this budget is genuinely anonymous api traffic, for which 100
 * requests per five minutes is generous. Asset urls, by contrast, are fetched by end-user browsers,
 * so they can neither carry the token nor be counted at that rate.
 */
export const config: RateLimiterConfig = {
	windowMs: 1000 * 60 * 5,
	limit: 100,
	keyGenerator: getClientKey,
	skip(c) {
		if (c.req.path.startsWith("/api/v1/assets/")) {
			return true;
		}

		return hasAccessToken(c);
	},
};

/**
 * The limit for the browser-facing asset routes.
 *
 * These are requested by the page, not by the website's server: a single article can ask for a
 * hero, a gallery, and a row of cards, each across several `srcset` candidates, so one navigation
 * is easily dozens of requests where an api call is one. Counting them against the global budget
 * would 429 a first-time visitor mid-page — and, because the bucket is shared, break the document
 * download links on that page too.
 *
 * The ceiling is high because it is not what protects imgproxy. Renditions are capped by the width
 * and aspect-ratio allowlists and are permanently cacheable, so a caller walking the whole grid
 * stops generating work and starts getting cache hits; a shared cache in front of the api collapses
 * repeat traffic further still. This limit only exists to stop a pathological client, not to shape
 * ordinary page loads.
 */
export const assetConfig: RateLimiterConfig = {
	windowMs: 1000 * 60 * 5,
	limit: 2000,
	keyGenerator: getClientKey,
	skip: hasAccessToken,
};
