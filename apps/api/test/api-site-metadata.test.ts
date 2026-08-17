import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { SiteMetadata } from "@/routes/site-metadata/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

async function seed(db: Database) {
	const title = f.company.name();
	const description = f.lorem.paragraph();
	const ogTitle = f.lorem.sentence();
	const ogDescription = f.lorem.sentence();

	await db
		.insert(schema.siteMetadata)
		.values({ title, description, ogTitle, ogDescription })
		.onConflictDoUpdate({
			target: schema.siteMetadata.id,
			set: { title, description, ogTitle, ogDescription },
		});

	return { title, description, ogTitle, ogDescription };
}

describe("site-metadata", () => {
	describe("GET /api/site-metadata", () => {
		it("should return site metadata", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { title, ogTitle } = await seed(db);

				const response = await client["site-metadata"].$get();

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as SiteMetadata;

				expect(data).toMatchObject({ title, ogTitle });
				expect(data.ogImage).toBeNull();
			});
		});

		it("should return seeded title when metadata exists", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { title } = await seed(db);

				const response = await client["site-metadata"].$get();

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as SiteMetadata;

				expect(data).toMatchObject({ title });
			});
		});
	});
});
