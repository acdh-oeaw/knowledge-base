import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST } from "@/lib/openapi/responses";
import { validate } from "@/lib/openapi/validator";
import { GetSitemap } from "@/routes/sitemap/schemas";
import { getSitemap } from "@/routes/sitemap/service";

export const router = createRouter()
	/** GET /api/sitemap */
	.get(
		"/",
		describeRoute({
			tags: ["sitemap"],
			summary: "Get sitemap urls",
			description:
				"Retrieve every website url derived from published content, with the timestamp of its most recent publish. One entry per url, so urls shared by several documents appear once. Listing pages which are not backed by content are not included; consumers add their own static routes.",
			operationId: "getSitemap",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetSitemap.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		async (c) => {
			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getSitemap(db);

			const payload = await validate(GetSitemap.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
