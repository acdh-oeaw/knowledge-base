import * as Sentry from "@sentry/node";

import { env } from "~/config/env.config";

Sentry.init({
	dsn: env.API_SENTRY_DSN,
	/**
	 * Enable sending personally identifiable information.
	 *
	 * @see {@link https://docs.sentry.io/platforms/javascript/guides/node/data-management/data-collected/}
	 */
	sendDefaultPii: env.API_SENTRY_PII === "enabled",
});
