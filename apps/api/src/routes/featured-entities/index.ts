import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST } from "@/lib/openapi/responses";
import { validate } from "@/lib/openapi/validator";
import { GetFeaturedEntities } from "@/routes/featured-entities/schemas";
import { getFeaturedEntities } from "@/routes/featured-entities/service";

export const router = createRouter()
	/** GET /api/featured-entities */
	.get(
		"/",
		describeRoute({
			tags: ["featured-entities"],
			summary: "Get featured entities",
			description: "Retrieve the list of featured entities configured in site metadata",
			operationId: "getFeaturedEntities",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetFeaturedEntities.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		async (c) => {
			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getFeaturedEntities(db);

			const payload = await validate(GetFeaturedEntities.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
