import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetImpactCaseStudies,
	GetImpactCaseStudyById,
	GetImpactCaseStudyBySlug,
	GetImpactCaseStudySlugs,
} from "@/routes/impact-case-studies/schemas";
import {
	getImpactCaseStudies,
	getImpactCaseStudyById,
	getImpactCaseStudyBySlug,
	getImpactCaseStudySlugs,
} from "@/routes/impact-case-studies/service";

export const router = createRouter()
	/** GET /api/impact-case-studies */
	.get(
		"/",
		describeRoute({
			tags: ["impact-case-studies"],
			summary: "Get impact case studies",
			description: "Retrieve a paginated list of impact case studies",
			operationId: "getImpactCaseStudies",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetImpactCaseStudies.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetImpactCaseStudies.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getImpactCaseStudies(db, { limit, offset });

			const payload = await validate(GetImpactCaseStudies.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/impact-case-studies/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["impact-case-studies"],
			summary: "Get impact case study slugs",
			description: "Retrieve a paginated list of impact case study slugs",
			operationId: "getImpactCaseStudySlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetImpactCaseStudySlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetImpactCaseStudySlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getImpactCaseStudySlugs(db, { limit, offset });

			const payload = await validate(GetImpactCaseStudySlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/impact-case-studies/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["impact-case-studies"],
			summary: "Get impact case study by id",
			description: "Retrieve an impact case study by id",
			operationId: "getImpactCaseStudyById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetImpactCaseStudyById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetImpactCaseStudyById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getImpactCaseStudyById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetImpactCaseStudyById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/impact-case-studies/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["impact-case-studies"],
			summary: "Get impact case study by slug",
			description: "Retrieve an impact case study by slug",
			operationId: "getImpactCaseStudyBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetImpactCaseStudyBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetImpactCaseStudyBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getImpactCaseStudyBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetImpactCaseStudyBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
