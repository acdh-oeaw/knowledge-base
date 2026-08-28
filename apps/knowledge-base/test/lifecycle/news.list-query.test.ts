import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { describe, expect, it } from "vitest";

import {
	createDraftDocument,
	discardDraftVersion,
	publishVersion,
	touchVersion,
} from "@/lib/data/entity-lifecycle";
import { getNews } from "@/lib/data/news";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

async function seedDraftNews(tx: Transaction, title = f.lorem.sentence()) {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "news" },
		columns: { id: true },
	});
	assert(type, "news entity type not found in database");

	const asset = await tx.query.assets.findFirst({ columns: { id: true } });
	assert(asset, "No asset found in database — seed one first.");

	const { documentId, versionId } = await createDraftDocument(tx, type.id, slugify(title));
	await tx.insert(schema.news).values({
		id: versionId,
		title,
		summary: f.lorem.paragraph(),
		publicationDate: new Date("2025-01-15T00:00:00.000Z"),
		imageId: asset.id,
	});

	return { documentId, versionId, title };
}

describe("news list query — prefer draft, fallback to published", () => {
	it("draft-only document appears with status=draft and isPublished=false", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);

			const { data } = await getNews({}, tx);
			const item = data.find((d) => d.documentId === documentId);

			expect(item).toBeDefined();
			expect(item?.status).toBe("draft");
			expect(item?.isPublished).toBe(false);
		});
	});

	it("published-only document (after discard) appears with status=published and isPublished=true", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);
			await publishVersion(tx, documentId, newsLifecycleAdapter);
			await discardDraftVersion(tx, documentId, newsLifecycleAdapter);

			const { data } = await getNews({}, tx);
			const matching = data.filter((d) => d.documentId === documentId);

			expect(matching).toHaveLength(1);
			expect(matching[0]?.status).toBe("published");
			expect(matching[0]?.isPublished).toBe(true);
		});
	});

	it("draft+published document appears exactly once and hides a cloned no-op draft", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);
			await publishVersion(tx, documentId, newsLifecycleAdapter);

			const { data } = await getNews({}, tx);
			const matching = data.filter((d) => d.documentId === documentId);

			expect(matching).toHaveLength(1);
			expect(matching[0]?.status).toBe("draft");
			expect(matching[0]?.isPublished).toBe(true);
			expect(matching[0]?.hasDraft).toBe(false);
		});
	});

	it("total count is not double-counted across version states", async () => {
		await withTransaction(async (tx) => {
			const draftOnly = await seedDraftNews(tx);

			const draftAndPublished = await seedDraftNews(tx);
			await publishVersion(tx, draftAndPublished.documentId, newsLifecycleAdapter);

			const publishedOnly = await seedDraftNews(tx);
			await publishVersion(tx, publishedOnly.documentId, newsLifecycleAdapter);
			await discardDraftVersion(tx, publishedOnly.documentId, newsLifecycleAdapter);

			const seededIds = new Set([
				draftOnly.documentId,
				draftAndPublished.documentId,
				publishedOnly.documentId,
			]);

			const { data, total } = await getNews({ limit: 1000 }, tx);
			const seededInResults = data.filter((d) => seededIds.has(d.documentId));

			expect(seededInResults).toHaveLength(3);
			expect(total).toBeGreaterThanOrEqual(3);
		});
	});

	it("draft title is shown (not published title) when both versions exist", async () => {
		await withTransaction(async (tx) => {
			const originalTitle = f.lorem.sentence();
			const { documentId, versionId: draftVersionId } = await seedDraftNews(tx, originalTitle);
			await publishVersion(tx, documentId, newsLifecycleAdapter);

			const updatedTitle = f.lorem.sentence();
			await tx
				.update(schema.news)
				.set({ title: updatedTitle })
				.where(eq(schema.news.id, draftVersionId));

			const { data } = await getNews({}, tx);
			const item = data.find((d) => d.documentId === documentId);

			expect(item?.title).toBe(updatedTitle);
		});
	});

	it("newer draft changes appear as draft on top of live content", async () => {
		await withTransaction(async (tx) => {
			const originalTitle = f.lorem.sentence();
			const { documentId, versionId: draftVersionId } = await seedDraftNews(tx, originalTitle);
			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);
			const publishedVersion = await tx.query.entityVersions.findFirst({
				where: { id: publishedId },
				columns: { updatedAt: true },
			});
			assert(publishedVersion);

			const updatedTitle = f.lorem.sentence();
			await tx
				.update(schema.news)
				.set({ title: updatedTitle })
				.where(eq(schema.news.id, draftVersionId));
			await touchVersion(tx, draftVersionId, new Date(publishedVersion.updatedAt.getTime() + 1000));

			const { data } = await getNews({}, tx);
			const item = data.find((d) => d.documentId === documentId);

			expect(item?.title).toBe(updatedTitle);
			expect(item?.isPublished).toBe(true);
			expect(item?.hasDraft).toBe(true);
		});
	});
});
