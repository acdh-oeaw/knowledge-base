import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetProjectById,
	GetProjectBySlug,
	GetProjectSlugs,
	GetProjects,
} from "@/routes/projects/schemas";
import {
	getProjectById,
	getProjectBySlug,
	getProjectSlugs,
	getProjects,
} from "@/routes/projects/service";

export const router = createRouter()
	/** GET /api/projects */
	.get(
		"/",
		describeRoute({
			tags: ["projects"],
			summary: "Get projects",
			description: "Retrieve a paginated list of projects",
			operationId: "getProjects",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetProjects.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetProjects.QuerySchema),
		async (c) => {
			const { limit, offset, status } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getProjects(db, { limit, offset, status });

			const payload = await validate(GetProjects.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/projects/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["projects"],
			summary: "Get project slugs",
			description: "Retrieve a paginated list of project slugs",
			operationId: "getProjectSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetProjectSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetProjectSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getProjectSlugs(db, { limit, offset });

			const payload = await validate(GetProjectSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/projects/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["projects"],
			summary: "Get project by id",
			description: "Retrieve a project by id",
			operationId: "getProjectById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetProjectById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetProjectById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getProjectById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetProjectById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/projects/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["projects"],
			summary: "Get project by slug",
			description: "Retrieve a project by slug",
			operationId: "getProjectBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetProjectBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetProjectBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getProjectBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetProjectBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
