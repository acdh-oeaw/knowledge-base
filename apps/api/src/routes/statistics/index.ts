import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST } from "@/lib/openapi/responses";
import { validate } from "@/lib/openapi/validator";
import { GetStatistics } from "@/routes/statistics/schemas";
import { getStatistics } from "@/routes/statistics/service";

export const router = createRouter()
	/** GET /api/statistics */
	.get(
		"/",
		describeRoute({
			tags: ["statistics"],
			summary: "Get statistics",
			description: "Retrieve statistics",
			operationId: "getStatistics",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetStatistics.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		async (c) => {
			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getStatistics(db);

			const payload = await validate(GetStatistics.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
