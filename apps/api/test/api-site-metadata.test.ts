import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { SiteMetadata } from "@/routes/site-metadata/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

async function seed(db: Database) {
	const defaultLocale = await db.query.locales.findFirst({
		columns: { id: true },
		where: { isDefault: true },
	});
	assert(defaultLocale, "No default locale in database.");

	const title = f.company.name();
	const description = f.lorem.paragraph();
	const ogTitle = f.lorem.sentence();
	const ogDescription = f.lorem.sentence();

	await db
		.insert(schema.siteMetadataTranslations)
		.values({ localeId: defaultLocale.id, title, description, ogTitle, ogDescription })
		.onConflictDoUpdate({
			target: schema.siteMetadataTranslations.localeId,
			set: { title, description, ogTitle, ogDescription },
		});

	return { defaultLocaleId: defaultLocale.id, title, description, ogTitle, ogDescription };
}

describe("site-metadata", () => {
	describe("GET /api/site-metadata", () => {
		it("should return site metadata", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { title, ogTitle } = await seed(db);

				const response = await client["site-metadata"].$get({ query: {} });

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

				const response = await client["site-metadata"].$get({ query: {} });

				expect(response.status).toBe(200);

				/** @see {@link https://github.com/honojs/hono/issues/2280} */
				const data = (await response.json()) as SiteMetadata;

				expect(data).toMatchObject({ title });
			});
		});

		it("should resolve metadata into the requested locale, falling back to the default locale when no translation exists", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { title: defaultTitle } = await seed(db);

				const [otherLocale] = await db
					.insert(schema.locales)
					.values({ languageCode: "zz", name: "Test locale", isDefault: false })
					.returning({ id: schema.locales.id });
				assert(otherLocale, "Failed to insert test locale.");

				const translatedTitle = `${defaultTitle} (translated)`;

				await db.insert(schema.siteMetadataTranslations).values({
					localeId: otherLocale.id,
					title: translatedTitle,
					description: f.lorem.paragraph(),
				});

				const translatedResponse = await client["site-metadata"].$get({
					query: { locale: "zz" },
				});
				expect(translatedResponse.status).toBe(200);
				const translatedData = (await translatedResponse.json()) as SiteMetadata;
				expect(translatedData.title).toBe(translatedTitle);

				const fallbackResponse = await client["site-metadata"].$get({
					query: { locale: "yy" },
				});
				expect(fallbackResponse.status).toBe(200);
				const fallbackData = (await fallbackResponse.json()) as SiteMetadata;
				expect(fallbackData.title).toBe(defaultTitle);
			});
		});
	});
});
