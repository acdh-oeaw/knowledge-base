import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetWorkingGroupById,
	GetWorkingGroupBySlug,
	GetWorkingGroupSlugs,
	GetWorkingGroups,
} from "@/routes/working-groups/schemas";
import {
	getWorkingGroupById,
	getWorkingGroupBySlug,
	getWorkingGroupSlugs,
	getWorkingGroups,
} from "@/routes/working-groups/service";

export const router = createRouter()
	/** GET /api/working-groups */
	.get(
		"/",
		describeRoute({
			tags: ["working-groups"],
			summary: "Get working groups",
			description: "Retrieve a paginated list of working groups",
			operationId: "getWorkingGroups",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetWorkingGroups.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetWorkingGroups.QuerySchema),
		async (c) => {
			const { limit, offset, status } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getWorkingGroups(db, { limit, offset, status });

			const payload = await validate(GetWorkingGroups.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/working-groups/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["working-groups"],
			summary: "Get working group slugs",
			description: "Retrieve a paginated list of working group slugs",
			operationId: "getWorkingGroupSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetWorkingGroupSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetWorkingGroupSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getWorkingGroupSlugs(db, { limit, offset });

			const payload = await validate(GetWorkingGroupSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/working-groups/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["working-groups"],
			summary: "Get working group by id",
			description: "Retrieve a working group by id",
			operationId: "getWorkingGroupById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetWorkingGroupById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetWorkingGroupById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getWorkingGroupById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetWorkingGroupById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/working-groups/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["working-groups"],
			summary: "Get working group by slug",
			description: "Retrieve a working group by slug",
			operationId: "getWorkingGroupBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetWorkingGroupBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetWorkingGroupBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getWorkingGroupBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetWorkingGroupBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
