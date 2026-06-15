import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetDariahProjectById,
	GetDariahProjectBySlug,
	GetDariahProjectSlugs,
	GetDariahProjects,
} from "@/routes/dariah-projects/schemas";
import {
	getDariahProjectById,
	getDariahProjectBySlug,
	getDariahProjectSlugs,
	getDariahProjects,
} from "@/routes/dariah-projects/service";

export const router = createRouter()
	/** GET /api/dariah-projects */
	.get(
		"/",
		describeRoute({
			tags: ["dariah-projects"],
			summary: "Get DARIAH projects",
			description: "Retrieve a paginated list of DARIAH projects",
			operationId: "getDariahProjects",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetDariahProjects.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetDariahProjects.QuerySchema),
		async (c) => {
			const { limit, offset, status } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getDariahProjects(db, { limit, offset, status });

			const payload = await validate(GetDariahProjects.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/dariah-projects/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["dariah-projects"],
			summary: "Get DARIAH project slugs",
			description: "Retrieve a paginated list of DARIAH project slugs",
			operationId: "getDariahProjectSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetDariahProjectSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetDariahProjectSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getDariahProjectSlugs(db, { limit, offset });

			const payload = await validate(GetDariahProjectSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/dariah-projects/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["dariah-projects"],
			summary: "Get DARIAH project by id",
			description: "Retrieve a DARIAH project by id",
			operationId: "getDariahProjectById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetDariahProjectById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetDariahProjectById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getDariahProjectById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetDariahProjectById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/dariah-projects/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["dariah-projects"],
			summary: "Get DARIAH project by slug",
			description: "Retrieve a DARIAH project by slug",
			operationId: "getDariahProjectBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetDariahProjectBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetDariahProjectBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getDariahProjectBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetDariahProjectBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
