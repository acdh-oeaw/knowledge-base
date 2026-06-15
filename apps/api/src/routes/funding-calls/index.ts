import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetFundingCallById,
	GetFundingCallBySlug,
	GetFundingCallSlugs,
	GetFundingCalls,
} from "@/routes/funding-calls/schemas";
import {
	getFundingCallById,
	getFundingCallBySlug,
	getFundingCallSlugs,
	getFundingCalls,
} from "@/routes/funding-calls/service";

export const router = createRouter()
	/** GET /api/funding-calls */
	.get(
		"/",
		describeRoute({
			tags: ["funding-calls"],
			summary: "Get funding calls",
			description: "Retrieve a paginated list of funding calls",
			operationId: "getFundingCalls",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetFundingCalls.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetFundingCalls.QuerySchema),
		async (c) => {
			const { limit, offset, status } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getFundingCalls(db, { limit, offset, status });

			const payload = await validate(GetFundingCalls.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/funding-calls/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["funding-calls"],
			summary: "Get funding call slugs",
			description: "Retrieve a paginated list of funding call slugs",
			operationId: "getFundingCallSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetFundingCallSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetFundingCallSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getFundingCallSlugs(db, { limit, offset });

			const payload = await validate(GetFundingCallSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/funding-calls/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["funding-calls"],
			summary: "Get funding call by id",
			description: "Retrieve a funding call by id",
			operationId: "getFundingCallById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetFundingCallById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetFundingCallById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getFundingCallById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetFundingCallById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/funding-calls/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["funding-calls"],
			summary: "Get funding call by slug",
			description: "Retrieve a funding call by slug",
			operationId: "getFundingCallBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetFundingCallBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetFundingCallBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getFundingCallBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetFundingCallBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
