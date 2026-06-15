import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate } from "@/lib/openapi/validator";
import { GetSiteMetadata } from "@/routes/site-metadata/schemas";
import { getSiteMetadata } from "@/routes/site-metadata/service";

export const router = createRouter()
	/** GET /api/site-metadata */
	.get(
		"/",
		describeRoute({
			tags: ["site-metadata"],
			summary: "Get site metadata",
			description: "Retrieve global site metadata",
			operationId: "getSiteMetadata",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetSiteMetadata.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		async (c) => {
			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getSiteMetadata(db);

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetSiteMetadata.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
