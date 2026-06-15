import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetSpotlightArticleById,
	GetSpotlightArticleBySlug,
	GetSpotlightArticleSlugs,
	GetSpotlightArticles,
} from "@/routes/spotlight-articles/schemas";
import {
	getSpotlightArticleById,
	getSpotlightArticleBySlug,
	getSpotlightArticleSlugs,
	getSpotlightArticles,
} from "@/routes/spotlight-articles/service";

export const router = createRouter()
	/** GET /api/spotlight-articles */
	.get(
		"/",
		describeRoute({
			tags: ["spotlight-articles"],
			summary: "Get spotlight articles",
			description: "Retrieve a paginated list of spotlight articles",
			operationId: "getSpotlightArticles",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetSpotlightArticles.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetSpotlightArticles.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getSpotlightArticles(db, { limit, offset });

			const payload = await validate(GetSpotlightArticles.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/spotlight-articles/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["spotlight-articles"],
			summary: "Get spotlight article slugs",
			description: "Retrieve a paginated list of spotlight article slugs",
			operationId: "getSpotlightArticleSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetSpotlightArticleSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetSpotlightArticleSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getSpotlightArticleSlugs(db, { limit, offset });

			const payload = await validate(GetSpotlightArticleSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/spotlight-articles/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["spotlight-articles"],
			summary: "Get spotlight article by id",
			description: "Retrieve an spotlight article by id",
			operationId: "getSpotlightArticleById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetSpotlightArticleById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetSpotlightArticleById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getSpotlightArticleById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetSpotlightArticleById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/spotlight-articles/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["spotlight-articles"],
			summary: "Get spotlight article by slug",
			description: "Retrieve an spotlight article by slug",
			operationId: "getSpotlightArticleBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetSpotlightArticleBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetSpotlightArticleBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getSpotlightArticleBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetSpotlightArticleBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
