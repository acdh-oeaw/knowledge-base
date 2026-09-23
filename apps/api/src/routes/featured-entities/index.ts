import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolveLocaleId } from "@/lib/locales";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import { GetFeaturedEntities } from "@/routes/featured-entities/schemas";
import { getFeaturedEntities } from "@/routes/featured-entities/service";

export const router = createRouter()
	/** GET /api/featured-entities */
	.get(
		"/",
		describeRoute({
			tags: ["featured-entities"],
			summary: "Get featured entities",
			description:
				"Retrieve the list of featured entities configured in site metadata, localized into the requested locale (falling back to the default locale for entities without a translation)",
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
		validator("query", GetFeaturedEntities.QuerySchema),
		async (c) => {
			const { locale } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const localeId = (await resolveLocaleId(db, locale)) ?? undefined;

			const data = await getFeaturedEntities(db, { localeId });

			const payload = await validate(GetFeaturedEntities.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
