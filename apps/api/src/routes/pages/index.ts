import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import { GetPageById, GetPageBySlug, GetPageSlugs, GetPages } from "@/routes/pages/schemas";
import { getPageById, getPageBySlug, getPageSlugs, getPages } from "@/routes/pages/service";

export const router = createRouter()
	/** GET /api/pages */
	.get(
		"/",
		describeRoute({
			tags: ["pages"],
			summary: "Get pages",
			description: "Retrieve a paginated list of pages",
			operationId: "getPages",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetPages.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetPages.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getPages(db, { limit, offset });

			const payload = await validate(GetPages.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/pages/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["pages"],
			summary: "Get page slugs",
			description: "Retrieve a paginated list of page slugs",
			operationId: "getPageSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetPageSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetPageSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getPageSlugs(db, { limit, offset });

			const payload = await validate(GetPageSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/pages/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["pages"],
			summary: "Get page by id",
			description: "Retrieve an page by id",
			operationId: "getPageById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetPageById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetPageById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getPageById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetPageById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/pages/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["pages"],
			summary: "Get page by slug",
			description: "Retrieve an page by slug",
			operationId: "getPageBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetPageBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetPageBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getPageBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetPageBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
