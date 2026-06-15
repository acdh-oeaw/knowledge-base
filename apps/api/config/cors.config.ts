import type { cors } from "hono/cors";

import { env } from "~/config/env.config";

type CORSOptions = Parameters<typeof cors>[0];

export const config: CORSOptions = {
	allowMethods: ["GET", "HEAD", "POST"],
	origin:
		env.API_ALLOWED_ORIGINS != null
			? [env.API_BASE_URL, ...env.API_ALLOWED_ORIGINS]
			: env.API_BASE_URL,
};
