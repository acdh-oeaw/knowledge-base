import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { describe, expect, it } from "vitest";

import {
	createDraftDocument,
	discardDraftVersion,
	ensureDraftVersion,
	getDocumentLifecycleState,
	getDocumentVersions,
	publishVersion,
	touchVersion,
} from "@/lib/data/entity-lifecycle";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import type { db } from "@/lib/db";
import { eq, inArray } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getNewsType(tx: Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>) {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "news" },
		columns: { id: true },
	});
	assert(type, "news entity type not found in database");
	return type;
}

async function getTestAsset(tx: Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>) {
	const asset = await tx.query.assets.findFirst({
		columns: { id: true },
	});
	assert(asset, "No asset found in database — seed one first.");
	return asset;
}

async function seedDraftNews(
	tx: Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>,
	title = f.lorem.sentence(),
) {
	const type = await getNewsType(tx);
	const asset = await getTestAsset(tx);
	const slug = slugify(title);

	const { documentId, versionId } = await createDraftDocument(tx, type.id, slug);

	await tx
		.insert(schema.news)
		.values({ id: versionId, title, summary: f.lorem.paragraph(), imageId: asset.id });

	return { documentId, versionId, title, slug };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("news lifecycle", () => {
	it("createDraftDocument produces a draft version row, no published row", async () => {
		await withTransaction(async (tx) => {
			const { documentId, versionId } = await seedDraftNews(tx);

			const { draftId, publishedId } = await getDocumentVersions(tx, documentId);
			expect(draftId).toBe(versionId);
			expect(publishedId).toBeNull();
		});
	});

	it("publishVersion creates a published row and draft still exists", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);

			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);

			const versions = await getDocumentVersions(tx, documentId);
			expect(versions.publishedId).toBe(publishedId);
			expect(versions.draftId).not.toBeNull();
		});
	});

	it("published row has same title/summary as draft", async () => {
		await withTransaction(async (tx) => {
			const title = f.lorem.sentence();
			const { documentId } = await seedDraftNews(tx, title);

			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);

			const published = await tx.query.news.findFirst({ where: { id: publishedId } });
			expect(published?.title).toBe(title);
		});
	});

	it("publishVersion is stable: republish reuses the same published version ID", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);

			const firstPublishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);
			const secondPublishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);

			expect(secondPublishedId).toBe(firstPublishedId);
		});
	});

	it("republish updates published content from the current draft", async () => {
		await withTransaction(async (tx) => {
			const { documentId, versionId: draftVersionId } = await seedDraftNews(tx);
			await publishVersion(tx, documentId, newsLifecycleAdapter);

			const newTitle = f.lorem.sentence();
			await tx
				.update(schema.news)
				.set({ title: newTitle })
				.where(eq(schema.news.id, draftVersionId));

			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);
			const published = await tx.query.news.findFirst({ where: { id: publishedId } });

			expect(published?.title).toBe(newTitle);
		});
	});

	it("ensureDraftVersion returns existing draft without cloning", async () => {
		await withTransaction(async (tx) => {
			const { documentId, versionId: existingDraftId } = await seedDraftNews(tx);

			const returnedId = await ensureDraftVersion(tx, documentId, newsLifecycleAdapter);

			expect(returnedId).toBe(existingDraftId);

			// Only one version should exist (the draft).
			const versions = await getDocumentVersions(tx, documentId);
			expect(versions.publishedId).toBeNull();
		});
	});

	it("ensureDraftVersion creates draft from published when no draft exists", async () => {
		await withTransaction(async (tx) => {
			const title = f.lorem.sentence();
			const { documentId, versionId: draftVersionId } = await seedDraftNews(tx, title);
			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);

			// Discard the draft so only published remains.
			await discardDraftVersion(tx, documentId, newsLifecycleAdapter);
			const afterDiscard = await getDocumentVersions(tx, documentId);
			expect(afterDiscard.draftId).toBeNull();

			// Ensure draft → should clone from published.
			const newDraftId = await ensureDraftVersion(tx, documentId, newsLifecycleAdapter);
			expect(newDraftId).not.toBe(draftVersionId);
			expect(newDraftId).not.toBe(publishedId);

			const newDraft = await tx.query.news.findFirst({ where: { id: newDraftId } });
			expect(newDraft?.title).toBe(title);

			const versions = await tx
				.select({ id: schema.entityVersions.id, updatedAt: schema.entityVersions.updatedAt })
				.from(schema.entityVersions)
				.where(inArray(schema.entityVersions.id, [publishedId, newDraftId]));
			const byId = new Map(versions.map((version) => [version.id, version.updatedAt]));

			expect(byId.get(newDraftId)?.toISOString()).toBe(byId.get(publishedId)?.toISOString());
		});
	});

	it("publishVersion syncs published updatedAt with the draft timestamp", async () => {
		await withTransaction(async (tx) => {
			const { documentId, versionId: draftVersionId } = await seedDraftNews(tx);
			const updatedAt = new Date("2026-02-01T00:00:00.000Z");

			await touchVersion(tx, draftVersionId, updatedAt);
			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);

			const publishedVersion = await tx.query.entityVersions.findFirst({
				where: { id: publishedId },
				columns: { updatedAt: true },
			});

			expect(publishedVersion?.updatedAt.toISOString()).toBe(updatedAt.toISOString());
		});
	});

	it("discardDraftVersion removes the draft but leaves published intact", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);
			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);

			await discardDraftVersion(tx, documentId, newsLifecycleAdapter);

			const versions = await getDocumentVersions(tx, documentId);
			expect(versions.draftId).toBeNull();
			expect(versions.publishedId).toBe(publishedId);
		});
	});

	it("getDocumentLifecycleState treats a synced draft clone as no draft changes", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);
			await publishVersion(tx, documentId, newsLifecycleAdapter);

			const state = await getDocumentLifecycleState(tx, documentId);

			expect(state.publishedId).not.toBeNull();
			expect(state.draftId).not.toBeNull();
			expect(state.hasDraftChanges).toBe(false);
		});
	});

	it("getDocumentLifecycleState detects newer unpublished draft changes", async () => {
		await withTransaction(async (tx) => {
			const { documentId, versionId: draftVersionId } = await seedDraftNews(tx);
			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);
			const publishedVersion = await tx.query.entityVersions.findFirst({
				where: { id: publishedId },
				columns: { updatedAt: true },
			});
			assert(publishedVersion);

			await touchVersion(tx, draftVersionId, new Date(publishedVersion.updatedAt.getTime() + 1000));

			const state = await getDocumentLifecycleState(tx, documentId);

			expect(state.hasDraftChanges).toBe(true);
		});
	});

	it("publishVersion copies content blocks from draft to published", async () => {
		await withTransaction(async (tx) => {
			const { documentId, versionId: draftId } = await seedDraftNews(tx);

			// Add a content block to the draft.
			const [blockType, entityType] = await Promise.all([
				tx.query.contentBlockTypes.findFirst({
					where: { type: "rich_text" },
					columns: { id: true },
				}),
				tx.query.entityTypes.findFirst({ where: { type: "news" }, columns: { id: true } }),
			]);
			assert(blockType);
			assert(entityType);

			const fieldNameRow = await tx.query.entityTypesFieldsNames.findFirst({
				where: { entityTypeId: entityType.id, fieldName: "content" },
				columns: { id: true },
			});
			assert(fieldNameRow);

			const [field] = await tx
				.insert(schema.fields)
				.values({ entityVersionId: draftId, fieldNameId: fieldNameRow.id })
				.returning({ id: schema.fields.id });
			assert(field);

			const [block] = await tx
				.insert(schema.contentBlocks)
				.values({ fieldId: field.id, typeId: blockType.id, position: 0 })
				.returning({ id: schema.contentBlocks.id });
			assert(block);

			const richContent = { type: "doc", content: [{ type: "paragraph" }] };
			await tx.insert(schema.richTextContentBlocks).values({ id: block.id, content: richContent });

			// Publish.
			const publishedId = await publishVersion(tx, documentId, newsLifecycleAdapter);

			// Published version should have a cloned field + content block.
			const publishedFields = await tx
				.select({ id: schema.fields.id })
				.from(schema.fields)
				.where(eq(schema.fields.entityVersionId, publishedId));
			expect(publishedFields).toHaveLength(1);

			const publishedBlocks = await tx
				.select({ id: schema.contentBlocks.id })
				.from(schema.contentBlocks)
				.where(eq(schema.contentBlocks.fieldId, publishedFields[0]!.id));
			expect(publishedBlocks).toHaveLength(1);

			const publishedRichText = await tx.query.richTextContentBlocks.findFirst({
				where: { id: publishedBlocks[0]!.id },
			});
			expect(publishedRichText?.content).toMatchObject(richContent);
		});
	});

	it("unique constraint prevents two draft versions for one document", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedDraftNews(tx);

			// Trying to manually insert a second draft should violate the unique constraint.
			const draftStatus = await tx.query.entityStatus.findFirst({
				where: { type: "draft" },
				columns: { id: true },
			});
			assert(draftStatus);

			await expect(
				tx.insert(schema.entityVersions).values({ entityId: documentId, statusId: draftStatus.id }),
			).rejects.toThrow();
		});
	});
});
