import { type CacheTag, cacheTags, isCacheTag } from "@dariah-eric/cache-tags";
import { testClient } from "hono/testing";
import type { OpenAPIV3_1 } from "openapi-types";
import { describe, expect, it } from "vitest";

import { openapi } from "@/app";
import { createApp } from "@/lib/factory";
import { cacheTagsExtension } from "@/lib/openapi/describe-route";

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

		it("should declare cache tags from the shared vocabulary on every operation", async () => {
			const client = testClient(createApp().route("/docs", openapi));

			const response = await client.docs["openapi.json"].$get();
			const data = (await response.json()) as OpenAPIV3_1.Document;
			const undeclaredOperations: Array<string> = [];
			const unknownTags: Array<string> = [];
			const declaredTags = new Set<CacheTag>();

			for (const [path, pathItem] of Object.entries(data.paths ?? {})) {
				if (pathItem == null || "$ref" in pathItem) {
					continue;
				}

				for (const method of operationMethods) {
					const operation = pathItem[method];
					if (operation == null) {
						continue;
					}

					const tags: unknown = (operation as Record<string, unknown>)[cacheTagsExtension];

					if (!Array.isArray(tags)) {
						undeclaredOperations.push(`${method.toUpperCase()} ${path}`);
						continue;
					}

					for (const tag of tags as Array<unknown>) {
						if (isCacheTag(tag)) {
							declaredTags.add(tag);
						} else {
							unknownTags.push(`${method.toUpperCase()} ${path}: ${String(tag)}`);
						}
					}
				}
			}

			expect(undeclaredOperations).toEqual([]);
			expect(unknownTags).toEqual([]);

			/** A tag nothing reads is either dead, or an operation forgot to declare it. */
			const unreadTags = cacheTags.filter((tag) => !declaredTags.has(tag));
			expect(unreadTags).toEqual([]);
		});

		it("should document the revalidation webhook against the cache tag vocabulary", async () => {
			const client = testClient(createApp().route("/docs", openapi));

			const response = await client.docs["openapi.json"].$get();
			const data = (await response.json()) as OpenAPIV3_1.Document;

			expect(data.webhooks?.revalidate).toMatchObject({
				post: {
					requestBody: {
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/RevalidationWebhookPayload" },
							},
						},
					},
				},
			});

			expect(data.components?.schemas?.CacheTag).toMatchObject({
				type: "string",
				enum: [...cacheTags],
			});
		});
	});
});
