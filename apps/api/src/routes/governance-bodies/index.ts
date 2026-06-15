import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetGovernanceBodies,
	GetGovernanceBodyById,
	GetGovernanceBodyBySlug,
	GetGovernanceBodySlugs,
} from "@/routes/governance-bodies/schemas";
import {
	getGovernanceBodies,
	getGovernanceBodyById,
	getGovernanceBodyBySlug,
	getGovernanceBodySlugs,
} from "@/routes/governance-bodies/service";

export const router = createRouter()
	.get(
		"/",
		describeRoute({
			tags: ["governance-bodies"],
			summary: "Get governance bodies",
			description: "Retrieve a paginated list of governance bodies",
			operationId: "getGovernanceBodies",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetGovernanceBodies.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetGovernanceBodies.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getGovernanceBodies(db, { limit, offset });

			const payload = await validate(GetGovernanceBodies.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)
	.get(
		"/slugs",
		describeRoute({
			tags: ["governance-bodies"],
			summary: "Get governance body slugs",
			description: "Retrieve a paginated list of governance body slugs",
			operationId: "getGovernanceBodySlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetGovernanceBodySlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetGovernanceBodySlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getGovernanceBodySlugs(db, { limit, offset });

			const payload = await validate(GetGovernanceBodySlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)
	.get(
		"/:id",
		describeRoute({
			tags: ["governance-bodies"],
			summary: "Get governance body by id",
			description: "Retrieve a governance body by id",
			operationId: "getGovernanceBodyById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetGovernanceBodyById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetGovernanceBodyById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getGovernanceBodyById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetGovernanceBodyById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["governance-bodies"],
			summary: "Get governance body by slug",
			description: "Retrieve a governance body by slug",
			operationId: "getGovernanceBodyBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetGovernanceBodyBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetGovernanceBodyBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getGovernanceBodyBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetGovernanceBodyBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
