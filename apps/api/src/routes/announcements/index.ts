import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import { GetAnnouncements } from "@/routes/announcements/schemas";
import { getAnnouncements } from "@/routes/announcements/service";

export const router = createRouter()
	/** GET /api/announcements */
	.get(
		"/",
		describeRoute({
			tags: ["announcements"],
			summary: "Get announcements",
			description:
				"Retrieve a paginated, reverse-chronological list of news, opportunities and funding calls. Each item is tagged with its `type`; fetch the full record from the endpoint for that type. Featuring an item only affects the sort order: featured items come first, in the order they were configured, followed by the reverse-chronological remainder. Every announcement appears exactly once and is counted in `total`, so featured items occupy the start of the first page (subject to `limit`, `offset` and `type`).",
			operationId: "getAnnouncements",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetAnnouncements.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetAnnouncements.QuerySchema),
		async (c) => {
			const { limit, offset, type } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getAnnouncements(db, { limit, offset, type });

			const payload = await validate(GetAnnouncements.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
