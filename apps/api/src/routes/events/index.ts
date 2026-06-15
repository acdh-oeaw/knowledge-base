import { assert } from "@acdh-oeaw/lib";
import { describeRoute } from "hono-openapi";

import { createRouter } from "@/lib/factory";
import { resolver } from "@/lib/openapi/resolver";
import { BAD_REQUEST, NOT_FOUND } from "@/lib/openapi/responses";
import { validate, validator } from "@/lib/openapi/validator";
import { GetEventById, GetEventBySlug, GetEventSlugs, GetEvents } from "@/routes/events/schemas";
import { getEventById, getEventBySlug, getEventSlugs, getEvents } from "@/routes/events/service";

export const router = createRouter()
	/** GET /api/events */
	.get(
		"/",
		describeRoute({
			tags: ["events"],
			summary: "Get events",
			description: "Retrieve a paginated list of events",
			operationId: "getEvents",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetEvents.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetEvents.QuerySchema),
		async (c) => {
			const { from, until, limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getEvents(db, { limit, offset, from, until });

			const payload = await validate(GetEvents.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/events/slugs */
	.get(
		"/slugs",
		describeRoute({
			tags: ["events"],
			summary: "Get event slugs",
			description: "Retrieve a paginated list of event slugs",
			operationId: "getEventSlugs",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetEventSlugs.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
			},
		}),
		validator("query", GetEventSlugs.QuerySchema),
		async (c) => {
			const { limit, offset } = c.req.valid("query");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getEventSlugs(db, { limit, offset });

			const payload = await validate(GetEventSlugs.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/events/:id */
	.get(
		"/:id",
		describeRoute({
			tags: ["events"],
			summary: "Get event by id",
			description: "Retrieve an event by id",
			operationId: "getEventById",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetEventById.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetEventById.ParamsSchema),
		async (c) => {
			const { id } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getEventById(db, { id });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetEventById.ResponseSchema, data, 500);

			return c.json(payload);
		},
	)

	/** GET /api/events/slugs/:slug */
	.get(
		"/slugs/:slug",
		describeRoute({
			tags: ["events"],
			summary: "Get event by slug",
			description: "Retrieve an event by slug",
			operationId: "getEventBySlug",
			responses: {
				200: {
					description: "Success response",
					content: {
						"application/json": {
							schema: resolver(GetEventBySlug.ResponseSchema),
						},
					},
				},
				...BAD_REQUEST,
				...NOT_FOUND,
			},
		}),
		validator("param", GetEventBySlug.ParamsSchema),
		async (c) => {
			const { slug } = c.req.valid("param");

			const db = c.get("db");
			assert(db, "Database must be provided via middleware.");

			const data = await getEventBySlug(db, { slug });

			if (data == null) {
				return c.notFound();
			}

			const payload = await validate(GetEventBySlug.ResponseSchema, data, 500);

			return c.json(payload);
		},
	);
