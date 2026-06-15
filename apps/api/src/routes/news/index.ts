import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetNews,
	GetNewsItemById,
	GetNewsItemBySlug,
	GetNewsItemSlugs,
} from "@/routes/news/schemas";
import {
	getNews,
	getNewsItemById,
	getNewsItemBySlug,
	getNewsItemSlugs,
} from "@/routes/news/service";

export const router = createRouter()
	/** GET /api/news */
	.get(
		"/",
		describeRoute({
			tags: ["news"],
			summary: "Get news",
			description: "Retrieve a paginated list of news",
			operationId: "getNews",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNews.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetNews.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNews(db, { limit, offset });

			const payload = await validate(GetNews.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/news/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["news"],
			summary: "Get news item slugs",
			description: "Retrieve a paginated list of news item slugs",
			operationId: "getNewsItemSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNewsItemSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetNewsItemSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNewsItemSlugs(db, { limit, offset });

			const payload = await validate(GetNewsItemSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/news/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["news"],
			summary: "Get news item by id",
			description: "Retrieve an news item by id",
			operationId: "getNewsItemById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNewsItemById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetNewsItemById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNewsItemById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetNewsItemById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/news/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["news"],
			summary: "Get news item by slug",
			description: "Retrieve an news item by slug",
			operationId: "getNewsItemBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNewsItemBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetNewsItemBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNewsItemBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetNewsItemBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
