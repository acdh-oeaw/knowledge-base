import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import type { JSONContent } from "@tiptap/core";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { createTestClient } from "~/test/lib/create-test-client";
import { seedContentBlock } from "~/test/lib/seed-content-block";
import { withTransaction } from "~/test/lib/with-transaction";

async function getPublishedStatusId(db: Database): Promise<string> {
	const status = await db.query.entityStatus.findFirst({
		columns: { id: true },
		where: { type: "published" },
	});
	assert(status, "No entity status in database.");
	return status.id;
}

async function getEntityTypeId(db: Database, type: "news" | "persons"): Promise<string> {
	const entityType = await db.query.entityTypes.findFirst({
		columns: { id: true },
		where: { type },
	});
	assert(entityType, `No ${type} entity type in database.`);
	return entityType.id;
}

async function getDefaultLocaleId(db: Database): Promise<string> {
	const locale = await db.query.locales.findFirst({
		columns: { id: true },
		where: { isDefault: true },
	});
	assert(locale, "No default locale in database.");
	return locale.id;
}

/** A published document with one version in the default locale, reachable at `slug`. */
async function seedEntity(
	db: Database,
	{ typeId, statusId, slug }: { typeId: string; statusId: string; slug: string },
): Promise<{ entityId: string; versionId: string }> {
	const localeId = await getDefaultLocaleId(db);
	const entityId = uuidv7();
	const versionId = uuidv7();

	await db.insert(schema.entities).values({ id: entityId, typeId });
	await db.insert(schema.entityVersions).values({ id: versionId, entityId, statusId, localeId });
	await db.insert(schema.slugs).values({
		entityVersionId: versionId,
		entityId,
		typeId,
		localeId,
		isPublished: true,
		value: slug,
	});

	return { entityId, versionId };
}

async function seedImageAsset(db: Database): Promise<{ id: string; key: string }> {
	const id = uuidv7();
	const key = `avatars/${id}.jpg`;

	await db.insert(schema.assets).values({
		id,
		key,
		label: f.person.fullName(),
		mimeType: "image/jpeg",
		width: 1200,
		height: 1200,
	});

	return { id, key };
}

/** A published person with a portrait. Returns the person's document id. */
async function seedPerson(db: Database, name: string): Promise<{ entityId: string }> {
	const [statusId, typeId, asset] = await Promise.all([
		getPublishedStatusId(db),
		getEntityTypeId(db, "persons"),
		seedImageAsset(db),
	]);

	const { entityId, versionId } = await seedEntity(db, { typeId, statusId, slug: slugify(name) });
	await db.insert(schema.persons).values({
		id: versionId,
		name,
		sortName: name,
		imageId: asset.id,
	});

	return { entityId };
}

/** A published news item whose `content` field holds the given rich-text document. */
async function seedNewsItemWithContent(db: Database, content: JSONContent) {
	const [statusId, typeId, image] = await Promise.all([
		getPublishedStatusId(db),
		getEntityTypeId(db, "news"),
		seedImageAsset(db),
	]);

	const title = f.lorem.sentence();
	const { versionId } = await seedEntity(db, { typeId, statusId, slug: slugify(title) });
	await db.insert(schema.news).values({
		id: versionId,
		title,
		summary: f.lorem.paragraph(),
		publicationDate: f.date.past(),
		imageId: image.id,
	});

	await seedContentBlock(db, versionId, typeId, "content", content);

	return { id: versionId };
}

function documentWithQuote(authors: Array<Record<string, unknown>>): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "quoteBlock",
				attrs: { authors, description: null },
				content: [{ type: "paragraph", content: [{ type: "text", text: "A quotation." }] }],
			},
		],
	};
}

/** The authors of the first node of the first `rich_text` block in an API response. */
function firstQuoteAuthors(content: unknown): Array<Record<string, unknown>> {
	const blocks = content as Array<{ type: string; content?: JSONContent }>;
	const [block] = blocks;

	expect(block?.type).toBe("rich_text");

	const quote = block!.content!.content![0]!;
	expect(quote.type).toBe("quoteBlock");

	return quote.attrs!.authors as Array<Record<string, unknown>>;
}

describe("quote authors in content blocks", () => {
	it("should resolve a person to their current name, page and portrait", async () => {
		await withTransaction(async (db) => {
			const { entityId } = await seedPerson(db, "Ada Lovelace");
			const { id } = await seedNewsItemWithContent(
				db,
				// The stored name is what the person was called when credited; the current one wins.
				documentWithQuote([{ kind: "person", entityId, name: "A. Lovelace" }]),
			);

			const response = await createTestClient(db).news[":id"].$get({ param: { id } });
			const data = await response.json();

			assert("content" in data);
			const [author] = firstQuoteAuthors(data.content);

			expect(author).toMatchObject({
				kind: "person",
				entityId,
				name: "Ada Lovelace",
				entity: { id: entityId, type: "persons", label: "Ada Lovelace" },
				image: { mimeType: "image/jpeg", width: 1200 },
			});
		});
	});

	it("should fall back to the stored name for a person who is no longer published", async () => {
		await withTransaction(async (db) => {
			const entityId = uuidv7();
			const { id } = await seedNewsItemWithContent(
				db,
				documentWithQuote([{ kind: "person", entityId, name: "Ada Lovelace" }]),
			);

			const response = await createTestClient(db).news[":id"].$get({ param: { id } });
			const data = await response.json();

			assert("content" in data);
			const [author] = firstQuoteAuthors(data.content);

			expect(author).toEqual({
				kind: "person",
				entityId,
				name: "Ada Lovelace",
				entity: null,
				image: null,
			});
		});
	});

	it("should resolve a typed-in author's picture, and drop the editor's display url", async () => {
		await withTransaction(async (db) => {
			const { key } = await seedImageAsset(db);
			const { id } = await seedNewsItemWithContent(
				db,
				documentWithQuote([
					{ kind: "text", name: "Charles Babbage", imageKey: key, imageUrl: "https://stale" },
					{ kind: "text", name: "Grace Hopper" },
				]),
			);

			const response = await createTestClient(db).news[":id"].$get({ param: { id } });
			const data = await response.json();

			assert("content" in data);
			const [withPicture, withoutPicture] = firstQuoteAuthors(data.content);

			expect(withPicture).toMatchObject({
				kind: "text",
				name: "Charles Babbage",
				// oxlint-disable-next-line typescript/no-unsafe-assignment
				image: { srcUrl: expect.stringContaining(key), mimeType: "image/jpeg" },
			});
			expect(withPicture).not.toHaveProperty("imageKey");
			expect(withPicture).not.toHaveProperty("imageUrl");
			expect(withoutPicture).toEqual({ kind: "text", name: "Grace Hopper", image: null });
		});
	});
});
