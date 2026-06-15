import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetOpportunities,
	GetOpportunityById,
	GetOpportunityBySlug,
	GetOpportunitySlugs,
} from "@/routes/opportunities/schemas";
import {
	getOpportunities,
	getOpportunityById,
	getOpportunityBySlug,
	getOpportunitySlugs,
} from "@/routes/opportunities/service";

export const router = createRouter()
	/** GET /api/opportunities */
	.get(
		"/",
		describeRoute({
			tags: ["opportunities"],
			summary: "Get opportunities",
			description: "Retrieve a paginated list of opportunities",
			operationId: "getOpportunities",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetOpportunities.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetOpportunities.QuerySchema),
		async (c) => {
			const { limit, offset, source, status } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getOpportunities(db, { limit, offset, source, status });

			const payload = await validate(GetOpportunities.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/opportunities/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["opportunities"],
			summary: "Get opportunity slugs",
			description: "Retrieve a paginated list of opportunity slugs",
			operationId: "getOpportunitySlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetOpportunitySlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetOpportunitySlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getOpportunitySlugs(db, { limit, offset });

			const payload = await validate(GetOpportunitySlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/opportunities/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["opportunities"],
			summary: "Get opportunity by id",
			description: "Retrieve an opportunity by id",
			operationId: "getOpportunityById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetOpportunityById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetOpportunityById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getOpportunityById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetOpportunityById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/opportunities/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["opportunities"],
			summary: "Get opportunity by slug",
			description: "Retrieve an opportunity by slug",
			operationId: "getOpportunityBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetOpportunityBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetOpportunityBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getOpportunityBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetOpportunityBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
