import { STATUS_CODES } from "node:http";

import { resolver } from "hono-openapi";
import * as v from "valibot";

export const BAD_REQUEST = {
	400: {
		description: STATUS_CODES[400]!,
		content: {
			"application/json": {
				schema: resolver(
					v.pipe(
						v.object({ message: v.pipe(v.string(), v.examples([STATUS_CODES[400]!])) }),
						v.description("Bad request response"),
						v.metadata({ ref: "BadRequestResponse" }),
					),
				),
			},
		},
	},
};

export const UNAUTHORIZED = {
	401: {
		description: STATUS_CODES[401]!,
		content: {
			"application/json": {
				schema: resolver(
					v.pipe(
						v.object({ message: v.pipe(v.string(), v.examples([STATUS_CODES[401]!])) }),
						v.description("Unauthorized response"),
						v.metadata({ ref: "UnauthorizedResponse" }),
					),
				),
			},
		},
	},
};

export const NOT_FOUND = {
	404: {
		description: STATUS_CODES[404]!,
		content: {
			"application/json": {
				schema: resolver(
					v.pipe(
						v.object({ message: v.pipe(v.string(), v.examples([STATUS_CODES[404]!])) }),
						v.description("Not found response"),
						v.metadata({ ref: "NotFoundResponse" }),
					),
				),
			},
		},
	},
};

export const INTERNAL_SERVER_ERROR = {
	500: {
		description: STATUS_CODES[500]!,
		content: {
			"application/json": {
				schema: resolver(
					v.pipe(
						v.object({ message: v.pipe(v.string(), v.examples([STATUS_CODES[500]!])) }),
						v.description("Internal server error response"),
						v.metadata({ ref: "InternalServerErrorResponse" }),
					),
				),
			},
		},
	},
};
