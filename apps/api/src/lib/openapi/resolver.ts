import type { OverrideSchemaContext } from "@valibot/to-json-schema";
import { resolver as openApiResolver } from "hono-openapi";
import type * as v from "valibot";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function resolver(schema: v.GenericSchema | v.GenericSchemaAsync) {
	return openApiResolver(schema, {
		options: {
			overrideSchema(context: OverrideSchemaContext) {
				if (context.valibotSchema.type === "date") {
					return { type: "string", format: "date-time" };
				}

				return undefined;
			},
		},
	});
}
