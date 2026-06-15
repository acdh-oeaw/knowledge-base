import "@/instrumentation";

import { log } from "@acdh-oeaw/lib";
import { serve } from "@hono/node-server";

import { app } from "@/app";
import { env } from "~/config/env.config";

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
	log.info(`Server is running on port ${String(info.port)}.`);
});
