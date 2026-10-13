import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { describe, expect, it } from "vitest";

import {
	createDraftDocument,
	deleteAllDocumentVersions,
	ensureLocalizedDraftVersion,
	publishVersion,
} from "@/lib/data/entity-lifecycle";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

async function seedDraftNews(tx: Transaction) {
	const [type, asset] = await Promise.all([
		tx.query.entityTypes.findFirst({ where: { type: "news" }, columns: { id: true } }),
		tx.query.assets.findFirst({ columns: { id: true } }),
	]);
	assert(type, "news entity type not found in database");
	assert(asset, "No asset found in database — seed one first.");

	const title = f.lorem.sentence();
	const { documentId, versionId } = await createDraftDocument(tx, type.id, slugify(title));

	await tx.insert(schema.news).values({
		id: versionId,
		title,
		summary: f.lorem.paragraph(),
		publicationDate: new Date("2025-01-15T00:00:00.000Z"),
		imageId: asset.id,
	});

	return { documentId, typeId: type.id };
}

async function insertTranslationLocale(tx: Transaction) {
	const [locale] = await tx
		.insert(schema.locales)
		.values({ languageCode: "zz", name: "Test locale", isDefault: false })
		.returning({ id: schema.locales.id });
	assert(locale, "Failed to insert test locale.");
	return locale;
}

async function countDocumentRows(tx: Transaction, documentId: string) {
	const versions = await tx
		.select({ id: schema.entityVersions.id })
		.from(schema.entityVersions)
		.where(eq(schema.entityVersions.entityId, documentId));
	const slugs = await tx
		.select({ id: schema.slugs.id })
		.from(schema.slugs)
		.where(eq(schema.slugs.entityId, documentId));
	const redirects = await tx
		.select({ id: schema.slugRedirects.id })
		.from(schema.slugRedirects)
		.where(eq(schema.slugRedirects.entityId, documentId));

	return { versions: versions.length, slugs: slugs.length, redirects: redirects.length };
}

describe("deleteAllDocumentVersions", () => {
	it("deletes a default-locale-only document and leaves other documents untouched", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);
			await publishVersion(tx, documentId, newsLifecycleAdapter);
			const other = await seedDraftNews(tx);

			const otherBefore = await countDocumentRows(tx, other.documentId);

			await deleteAllDocumentVersions(tx, documentId, newsLifecycleAdapter);
			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));

			expect(await countDocumentRows(tx, documentId)).toEqual({
				versions: 0,
				slugs: 0,
				redirects: 0,
			});
			expect(await countDocumentRows(tx, other.documentId)).toEqual(otherBefore);
		});
	});

	it("deletes translations too, so the document row can be deleted", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);
			await publishVersion(tx, documentId, newsLifecycleAdapter);

			const locale = await insertTranslationLocale(tx);
			await ensureLocalizedDraftVersion(tx, documentId, newsLifecycleAdapter, locale.id);
			await publishVersion(tx, documentId, newsLifecycleAdapter, locale.id);

			// Default-locale draft + published, translation draft + published.
			expect((await countDocumentRows(tx, documentId)).versions).toBe(4);

			await deleteAllDocumentVersions(tx, documentId, newsLifecycleAdapter);
			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));

			expect(await countDocumentRows(tx, documentId)).toEqual({
				versions: 0,
				slugs: 0,
				redirects: 0,
			});
		});
	});

	it("deletes the document's slug redirects", async () => {
		await withTransaction(async (tx) => {
			const { documentId, typeId } = await seedDraftNews(tx);
			const defaultLocale = await tx.query.locales.findFirst({
				where: { isDefault: true },
				columns: { id: true },
			});
			assert(defaultLocale, "Default locale not found in database.");

			await tx.insert(schema.slugRedirects).values({
				entityId: documentId,
				typeId,
				localeId: defaultLocale.id,
				oldValue: `${slugify(f.lorem.words(3))}-old`,
			});

			await deleteAllDocumentVersions(tx, documentId, newsLifecycleAdapter);
			await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));

			expect(await countDocumentRows(tx, documentId)).toEqual({
				versions: 0,
				slugs: 0,
				redirects: 0,
			});
		});
	});
});
