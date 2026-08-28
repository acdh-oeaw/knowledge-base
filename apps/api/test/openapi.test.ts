import { testClient } from "hono/testing";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { openapi } from "@/app";
import { createApp } from "@/lib/factory";

function normalizeSpec(document: OpenAPIV3_1.Document): OpenAPIV3_1.Document {
	return {
		...document,
		servers: document.servers?.map((server) => {
			return {
				...server,
				url: "{API_BASE_URL}",
			};
		}),
	};
}

const operationMethods = [
	"get",
	"put",
	"post",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
] as const;

function resolveParameter(
	document: OpenAPIV3_1.Document,
	parameter: OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject,
): OpenAPIV3_1.ReferenceObject | OpenAPIV3_1.ParameterObject {
	if (!("$ref" in parameter)) {
		return parameter;
	}

	const prefix = "#/components/parameters/";
	if (!parameter.$ref.startsWith(prefix)) {
		return parameter;
	}

	return document.components?.parameters?.[parameter.$ref.slice(prefix.length)] ?? parameter;
}

describe("openapi", () => {
	describe("GET /docs/openapi.json", () => {
		it("should match the api contract snapshot", async () => {
			const client = testClient(createApp().route("/docs", openapi));

			const response = await client.docs["openapi.json"].$get();

			expect(response.status).toBe(200);

			const data = (await response.json()) as OpenAPIV3_1.Document;

			expect(normalizeSpec(data)).toMatchSnapshot();
		});

		it("should expose descriptions on query parameters", async () => {
			const client = testClient(createApp().route("/docs", openapi));

			const response = await client.docs["openapi.json"].$get();
			const data = (await response.json()) as OpenAPIV3_1.Document;
			const undocumentedParameters: Array<string> = [];

			for (const [path, pathItem] of Object.entries(data.paths ?? {})) {
				if (pathItem == null || "$ref" in pathItem) {
					continue;
				}

				for (const method of operationMethods) {
					const operation = pathItem[method];
					if (operation == null) {
						continue;
					}

					const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];

					for (const unresolvedParameter of parameters) {
						const parameter = resolveParameter(data, unresolvedParameter);
						if ("$ref" in parameter || parameter.in !== "query") {
							continue;
						}

						if (parameter.description == null || parameter.description.length === 0) {
							undocumentedParameters.push(`${method.toUpperCase()} ${path}: ${parameter.name}`);
						}
					}
				}
			}

			expect(undocumentedParameters).toEqual([]);
		});
	});
});
