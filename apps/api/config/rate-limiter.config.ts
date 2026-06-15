import type { ConfigProps as RateLimiterConfig } from "hono-rate-limiter";

import { env } from "~/config/env.config";

export const config: RateLimiterConfig = {
	windowMs: 1000 * 60 * 5,
	limit: 100,
	keyGenerator(c) {
		return c.req.header("x-forwarded-for") ?? "";
	},
	skip(c) {
		if (env.API_ACCESS_TOKEN == null) {
			return false;
		}

		return c.req.header("x-api-access-token") === env.API_ACCESS_TOKEN;
	},
};
