import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetNationalConsortia,
	GetNationalConsortiumById,
	GetNationalConsortiumBySlug,
	GetNationalConsortiumSlugs,
} from "@/routes/national-consortia/schemas";
import {
	getNationalConsortia,
	getNationalConsortiumById,
	getNationalConsortiumBySlug,
	getNationalConsortiumSlugs,
} from "@/routes/national-consortia/service";

export const router = createRouter()
	/** GET /api/national-consortia */
	.get(
		"/",
		describeRoute({
			tags: ["national-consortia"],
			summary: "Get national consortia",
			description: "Retrieve a paginated list of national consortia",
			operationId: "getNationalConsortia",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNationalConsortia.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetNationalConsortia.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNationalConsortia(db, { limit, offset });

			const payload = await validate(GetNationalConsortia.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/national-consortia/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["national-consortia"],
			summary: "Get national consortium slugs",
			description: "Retrieve a paginated list of national consortium slugs",
			operationId: "getNationalConsortiumSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNationalConsortiumSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetNationalConsortiumSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNationalConsortiumSlugs(db, { limit, offset });

			const payload = await validate(GetNationalConsortiumSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/national-consortia/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["national-consortia"],
			summary: "Get national consortium by id",
			description: "Retrieve a national consortium by id",
			operationId: "getNationalConsortiumById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNationalConsortiumById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetNationalConsortiumById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNationalConsortiumById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetNationalConsortiumById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/national-consortia/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["national-consortia"],
			summary: "Get national consortium by slug",
			description: "Retrieve a national consortium by slug",
			operationId: "getNationalConsortiumBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetNationalConsortiumBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetNationalConsortiumBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getNationalConsortiumBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetNationalConsortiumBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
