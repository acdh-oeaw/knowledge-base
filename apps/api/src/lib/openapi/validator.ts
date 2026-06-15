import { STATUS_CODES } from "node:http";

import type { ValidationTargets } from "hono";
import { validator as openApiValidator } from "hono-openapi";
import { HTTPException } from "hono/http-exception";
import * as v from "valibot";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function validator<
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
	TValidationTargets extends keyof ValidationTargets,
	TSchema extends v.GenericSchema | v.GenericSchemaAsync,
>(target: TValidationTargets, schema: TSchema) {
	return openApiValidator(target, schema, (result) => {
		if (!result.success) {
			const status = 400;
			throw new HTTPException(status, { cause: result.error, message: STATUS_CODES[status] });
		}
	});
}

export async function validate<TValidationSchema extends v.GenericSchema | v.GenericSchemaAsync>(
	schema: TValidationSchema,
	value: unknown,
	status: 400 | 500 = 400,
): Promise<v.InferOutput<TValidationSchema>> {
	try {
		return await v.parseAsync(schema, value);
	} catch (error) {
		throw new HTTPException(status, { cause: error, message: STATUS_CODES[status] });
	}
}
