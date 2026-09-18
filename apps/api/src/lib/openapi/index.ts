import { cacheTags } from "@dariah-eric/cache-tags";
import { swaggerUI } from "@hono/swagger-ui";
import { openAPIRouteHandler } from "hono-openapi";

import { type createApp, createRouter } from "@/lib/factory";
import { cacheTagsExtension } from "@/lib/openapi/describe-route";
import { env } from "~/config/env.config";
import { config } from "~/config/openapi.config";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createOpenApi(app: ReturnType<typeof createApp>) {
	return createRouter()
		.get(
			"/openapi.json",
			openAPIRouteHandler(app, {
				documentation: {
					components: {
						schemas: {
							CacheTag: {
								type: "string",
								enum: [...cacheTags],
								description: `A slice of the data this api serves. Every operation lists the tags it reads under \`${cacheTagsExtension}\`; the \`revalidate\` webhook delivers the tags a content change touched.`,
							},
							RevalidationWebhookPayload: {
								type: "object",
								required: ["tags"],
								properties: {
									tags: {
										type: "array",
										items: { $ref: "#/components/schemas/CacheTag" },
										minItems: 1,
										uniqueItems: true,
									},
								},
							},
						},
						securitySchemes: {
							apiAccessToken: {
								type: "apiKey",
								in: "header",
								name: "x-api-access-token",
								description: "Required for protected endpoints, and to bypass rate limits.",
							},
							revalidationWebhookSecret: {
								type: "http",
								scheme: "bearer",
								description:
									"Shared secret the knowledge base sends with every revalidation webhook request.",
							},
						},
					},
					info: config,
					servers: [{ url: env.API_BASE_URL, description: config.description }],
					webhooks: {
						revalidate: {
							post: {
								summary: "Content changed",
								description: `Sent by the knowledge base after content is published, updated or deleted. Each tag in the payload names a data slice; every operation whose \`${cacheTagsExtension}\` contains one of them may now return different data, so a consumer should invalidate whatever it cached from those operations.`,
								operationId: "revalidate",
								security: [{ revalidationWebhookSecret: [] }],
								requestBody: {
									required: true,
									content: {
										"application/json": {
											schema: { $ref: "#/components/schemas/RevalidationWebhookPayload" },
										},
									},
								},
								responses: {
									"2XX": { description: "Acknowledged" },
								},
							},
						},
					},
				},
			}),
		)

		.get("/", swaggerUI({ url: "/docs/openapi.json", title: config.title }));
}
