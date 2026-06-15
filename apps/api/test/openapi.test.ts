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

describe("openapi", () => {
	describe("GET /docs/openapi.json", () => {
		it("should match the api contract snapshot", async () => {
			const client = testClient(createApp().route("/docs", openapi));

			const response = await client.docs["openapi.json"].$get();

			expect(response.status).toBe(200);

			const data = (await response.json()) as OpenAPIV3_1.Document;

			expect(normalizeSpec(data)).toMatchSnapshot();
		});
	});
});
