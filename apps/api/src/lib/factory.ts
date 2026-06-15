import { STATUS_CODES } from "node:http";

import type { StorageService } from "@acdh-knowledge-base/storage";
import * as Sentry from "@sentry/node";
import type { TypedResponse } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { cors } from "hono/cors";
import { createFactory } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { requestId } from "hono/request-id";

import type { Database, Transaction } from "@/middlewares/db";
import { type Logger, logger } from "@/middlewares/logger";
import { config as corsConfig } from "~/config/cors.config";
import { config as rateLimiterConfig } from "~/config/rate-limiter.config";

/** @see {@link https://hono.dev/docs/guides/rpc#not-found} */
declare module "hono" {
	interface NotFoundResponse extends Response, TypedResponse<{ message: string }, 404, "json"> {}
}

interface Env {
	Variables: {
		db?: Database | Transaction;
		logger: Logger;
		storage?: StorageService;
	};
}

const factory = createFactory<Env>({ defaultAppOptions: { strict: false } });

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createApp() {
	const app = factory
		.createApp()
		.use(requestId())
		.use(cors(corsConfig))
		.get("/health", (c) => {
			const status = 200;
			return c.json({ message: STATUS_CODES[status]! }, status);
		})
		.use(rateLimiter(rateLimiterConfig))
		.use(logger())

		.notFound((c) => {
			const status = 404;
			return c.json({ message: STATUS_CODES[status]! }, status);
		})

		.onError((error, c) => {
			const logger = c.get("logger");

			logger.error(error);

			Sentry.captureException(error);

			if (error instanceof HTTPException) {
				return c.json({ message: error.message }, error.status);
			}

			const status = 500;
			return c.json({ message: STATUS_CODES[status]! }, status);
		});

	return app;
}

export const { createApp: createRouter, createHandlers, createMiddleware } = factory;
