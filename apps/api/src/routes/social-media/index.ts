import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import { GetSocialMediaById, GetSocialMediaList } from "@/routes/social-media/schemas";
import { getSocialMediaById, getSocialMediaList } from "@/routes/social-media/service";

export const router = createRouter()
	/** GET /api/social-media */
	.get(
		"/",
		describeRoute({
			tags: ["social-media"],
			summary: "Get social media",
			description: "Retrieve a paginated list of social media",
			operationId: "getSocialMediaList",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetSocialMediaList.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetSocialMediaList.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getSocialMediaList(db, { limit, offset });

			const payload = await validate(GetSocialMediaList.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/social-media/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["social-media"],
			summary: "Get social media by id",
			description: "Retrieve a social media entry by id",
			operationId: "getSocialMediaById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetSocialMediaById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetSocialMediaById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getSocialMediaById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetSocialMediaById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
