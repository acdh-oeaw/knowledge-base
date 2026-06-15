import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import { GetNavigation } from "@/routes/navigation/schemas";
import { getNavigation } from "@/routes/navigation/service";

export const router = createRouter()
	/** GET /api/navigation */
	.get(
		"/",
		describeRoute({
			tags: ["navigation"],
			summary: "Get navigation",
			description:
				"Retrieve navigation menus with their items. Optionally filter by menu name using the `menu` query parameter.",
			operationId: "getNavigation",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNavigation.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetNavigation.QuerySchema),
		async (c) => {
			const { menu } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNavigation(db, { menu });

			const payload = await validate(GetNavigation.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
