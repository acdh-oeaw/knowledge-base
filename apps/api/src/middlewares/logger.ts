import { pinoLogger } from "hono-pino";

import { env } from "~/config/env.config";

export type { PinoLogger as Logger } from "hono-pino";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function logger() {
	return pinoLogger({
		pino: { level: env.API_LOG_LEVEL },
	});
}
