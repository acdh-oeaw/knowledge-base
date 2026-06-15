import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetInstitutionById,
	GetInstitutionBySlug,
	GetInstitutionSlugs,
	GetInstitutions,
} from "@/routes/institutions/schemas";
import {
	getInstitutionById,
	getInstitutionBySlug,
	getInstitutionSlugs,
	getInstitutions,
} from "@/routes/institutions/service";

export const router = createRouter()
	/** GET /api/institutions */
	.get(
		"/",
		describeRoute({
			tags: ["institutions"],
			summary: "Get institutions",
			description:
				"Retrieve a paginated list of institutions that are partner institutions or cooperating partners of the DARIAH-EU ERIC, optionally filtered by relation status",
			operationId: "getInstitutions",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetInstitutions.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetInstitutions.QuerySchema),
		async (c) => {
			const { limit, offset, status } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getInstitutions(db, { limit, offset, status });

			const payload = await validate(GetInstitutions.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/institutions/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["institutions"],
			summary: "Get institution slugs",
			description: "Retrieve a paginated list of institution slugs",
			operationId: "getInstitutionSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetInstitutionSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetInstitutionSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getInstitutionSlugs(db, { limit, offset });

			const payload = await validate(GetInstitutionSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/institutions/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["institutions"],
			summary: "Get institution by id",
			description: "Retrieve an institution by id",
			operationId: "getInstitutionById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetInstitutionById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetInstitutionById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getInstitutionById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetInstitutionById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/institutions/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["institutions"],
			summary: "Get institution by slug",
			description: "Retrieve an institution by slug",
			operationId: "getInstitutionBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetInstitutionBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetInstitutionBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getInstitutionBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetInstitutionBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
