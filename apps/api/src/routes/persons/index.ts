import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import {
	GetPersonById,
	GetPersonBySlug,
	GetPersonSlugs,
	GetPersons,
} from "@/routes/persons/schemas";
import {
	getPersonById,
	getPersonBySlug,
	getPersonSlugs,
	getPersons,
} from "@/routes/persons/service";

export const router = createRouter()
	/** GET /api/persons */
	.get(
		"/",
		describeRoute({
			tags: ["persons"],
			summary: "Get persons",
			description: "Retrieve a paginated list of persons",
			operationId: "getPersons",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetPersons.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetPersons.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getPersons(db, { limit, offset });

			const payload = await validate(GetPersons.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/persons/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["persons"],
			summary: "Get person slugs",
			description: "Retrieve a paginated list of person slugs",
			operationId: "getPersonSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetPersonSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetPersonSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getPersonSlugs(db, { limit, offset });

			const payload = await validate(GetPersonSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/persons/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["persons"],
			summary: "Get person by id",
			description: "Retrieve a person by id",
			operationId: "getPersonById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetPersonById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetPersonById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getPersonById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetPersonById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/persons/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["persons"],
			summary: "Get person by slug",
			description: "Retrieve a person by slug",
			operationId: "getPersonBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetPersonBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetPersonBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getPersonBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetPersonBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
