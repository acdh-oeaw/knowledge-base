import { describeRoute } from "hono-openapi";
import { rateLimiter } from "hono-rate-limiter";
import { HTTPException } from "hono/http-exception";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR, UNAUTHORIZED } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import { GetNewsletters, SubscribeNewsletter } from "@/routes/newsletters/schemas";
import { getNewsletters, subscribeToNewsletter } from "@/routes/newsletters/service";
import { env } from "~/config/env.config";

const subscribeRateLimiter = rateLimiter({
	windowMs: 1000 * 60 * 5,
	limit: 10,
	keyGenerator(c) {
		return c.req.header("x-forwarded-for") ?? "";
	},
});

export const router = createRouter()
	/** GET /api/newsletters */
	.get(
		"/",
		describeRoute({
			tags: ["newsletters"],
			summary: "Get newsletters",
			description: "Retrieve a paginated list of newsletter campaigns from Mailchimp",
			operationId: "getNewsletters",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNewsletters.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetNewsletters.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const data = await getNewsletters({ limit, offset });

			const payload = await validate(GetNewsletters.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** POST /api/newsletters/subscribe */
	.post(
		"/subscribe",
		describeRoute({
			tags: ["newsletters"],
			summary: "Subscribe to newsletter",
			description: "Subscribe an email address to the Mailchimp mailing list",
			operationId: "subscribeToNewsletter",
			requestBody: {
				required: true,
				content: {
					"application/json": {
						schema: SubscribeNewsletter.RequestSchema,
					},
				},
			},
			responses: {
				201: {
					description: "Subscription created",
					content: {
						"application/json": {
							schema: resolver(SubscribeNewsletter.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...UNAUTHORIZED,
				...INTERNAL_SERVER_ERROR,
			},
			security: [{ apiAccessToken: [] }],
		}),
		subscribeRateLimiter,
		async (c, next) => {
			if (env.API_ACCESS_TOKEN == null) {
				throw new Error("Missing API_ACCESS_TOKEN");
			}

			if (c.req.header("x-api-access-token") !== env.API_ACCESS_TOKEN) {
				throw new HTTPException(401, { message: "Unauthorized" });
			}

			await next();
		},
		validator("json", SubscribeNewsletter.RequestSchema),
		async (c) => {
			const { email } = c.req.valid("json");
			const logger = c.get("logger");

			const data = await subscribeToNewsletter({ email, logger });

			const payload = await validate(SubscribeNewsletter.ResponseSchema, data, 500);

			return c.json(payload, 201);
		},
	);
