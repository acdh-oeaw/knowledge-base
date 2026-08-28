import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { describe, expect, it } from "vitest";

import {
	createDraftDocument,
	createDraftDocumentFromTitle,
	createDraftDocumentWithSlug,
	publishVersion,
	updateDraftDocumentSlug,
} from "@/lib/data/entity-lifecycle";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import type { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { maxSlugLength } from "@/lib/slug";
import { UserFacingError } from "@/lib/user-facing-error";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>;

async function getEntityTypeId(tx: Tx, type: "events" | "news" | "persons"): Promise<string> {
	const row = await tx.query.entityTypes.findFirst({
		where: { type },
		columns: { id: true },
	});
	assert(row, `entity type "${type}" not found in database`);

	return row.id;
}

/** Distinctive enough that the derived slug cannot collide with real seed data. */
function uniqueTitle(): string {
	return `Slug Derivation ${f.string.alphanumeric(10)}`;
}

describe("createDraftDocumentFromTitle", () => {
	it("keeps the derived slug when the type does not use it yet", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const title = uniqueTitle();

			const created = await createDraftDocumentFromTitle(tx, typeId, title);

			expect(created.slug).toBe(slugify(title));
		});
	});

	it("derives a free slug instead of failing when the title is already taken", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const title = uniqueTitle();
			const base = slugify(title);

			const first = await createDraftDocumentFromTitle(tx, typeId, title);
			const second = await createDraftDocumentFromTitle(tx, typeId, title);
			const third = await createDraftDocumentFromTitle(tx, typeId, title);

			expect([first.slug, second.slug, third.slug]).toStrictEqual([base, `${base}-2`, `${base}-3`]);
		});
	});

	/**
	 * The savepoint is what makes the retry viable: a unique violation poisons the transaction it is
	 * raised in, so without one the collision above would abort the caller's whole mutation — every
	 * write after it included.
	 */
	it("leaves the enclosing transaction usable after a collision", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const title = uniqueTitle();

			await createDraftDocumentFromTitle(tx, typeId, title);
			await createDraftDocumentFromTitle(tx, typeId, title);

			// Any statement on the same transaction would error with "current transaction is aborted"
			// if the collision had not been contained.
			const followUp = await createDraftDocumentFromTitle(tx, typeId, uniqueTitle());

			expect(followUp.documentId).toBeTypeOf("string");
		});
	});

	/**
	 * `slugify` drops anything it cannot transliterate, so a CJK-only person name — reachable via
	 * delegated person creation — reduces to "". Storing that would leave the entity on an
	 * unreachable `/persons//details`.
	 */
	it("falls back to a reachable slug when the title slugifies to nothing", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");

			const created = await createDraftDocumentFromTitle(tx, typeId, "日本語");

			expect(created.slug).toMatch(/^news-[0-9a-f]{8}$/);
		});
	});

	it("keeps two untranslatable titles on distinct slugs", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");

			const first = await createDraftDocumentFromTitle(tx, typeId, "日本語");
			const second = await createDraftDocumentFromTitle(tx, typeId, "!!!");

			expect(first.slug).not.toBe(second.slug);
		});
	});

	/**
	 * The slug ends up in a filename when the website prerenders the page, so an overlong one breaks
	 * a build rather than the create. Truncating is the right trade here: nobody chose this slug, and
	 * the title it came from stays intact.
	 */
	it("cuts a slug derived from a very long title down to the limit", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const title = `${uniqueTitle()} ${"long word ".repeat(60)}`;

			const created = await createDraftDocumentFromTitle(tx, typeId, title);

			expect(created.slug.length).toBeLessThanOrEqual(maxSlugLength);
			// A prefix of the untruncated slug, and still a well-formed one.
			expect(slugify(title).startsWith(created.slug)).toBe(true);
			expect(created.slug.endsWith("-")).toBe(false);
		});
	});

	it("keeps the dedup suffix of a truncated slug inside the limit", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const title = `${uniqueTitle()} ${"long word ".repeat(60)}`;

			const first = await createDraftDocumentFromTitle(tx, typeId, title);
			const second = await createDraftDocumentFromTitle(tx, typeId, title);

			expect(second.slug).toBe(`${first.slug}-2`);
			expect(second.slug.length).toBeLessThanOrEqual(maxSlugLength);
		});
	});

	it("does not suffix a slug that is only taken under another entity type", async () => {
		await withTransaction(async (tx) => {
			const title = uniqueTitle();
			const newsTypeId = await getEntityTypeId(tx, "news");
			const eventsTypeId = await getEntityTypeId(tx, "events");

			const news = await createDraftDocumentFromTitle(tx, newsTypeId, title);
			const event = await createDraftDocumentFromTitle(tx, eventsTypeId, title);

			// Uniqueness is scoped to (type, slug), so both types may hold the same slug.
			expect(event.slug).toBe(slugify(title));
			expect(news.slug).toBe(slugify(title));
		});
	});
});

describe("createDraftDocument", () => {
	it("rejects a slug the type already uses rather than deriving a free one", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const slug = slugify(uniqueTitle());

			await createDraftDocument(tx, typeId, slug);

			// An explicit slug is the caller's choice, so a collision must surface as an error — the
			// "entity slug already exists" message — instead of quietly becoming `-2`.
			await expect(createDraftDocument(tx, typeId, slug)).rejects.toThrow();
		});
	});

	/**
	 * A slug this long only reaches the data layer past the form schema, but it must not reach the
	 * database: the website turns it into a filename when it prerenders the page.
	 */
	it("refuses a slug longer than a URL segment may be", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");

			await expect(
				createDraftDocument(tx, typeId, "a".repeat(maxSlugLength + 1)),
			).rejects.toBeInstanceOf(UserFacingError);
		});
	});
});

describe("createDraftDocumentWithSlug", () => {
	it("stores the slug the user chose, in normalised form", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const chosen = `Chosen Slug ${f.string.alphanumeric(8)}`;

			const created = await createDraftDocumentWithSlug(tx, typeId, {
				requestedSlug: slugify(chosen),
				title: uniqueTitle(),
			});

			expect(created.slug).toBe(slugify(chosen));
		});
	});

	it("derives from the title when the user chose no slug", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const title = uniqueTitle();

			const created = await createDraftDocumentWithSlug(tx, typeId, {
				requestedSlug: null,
				title,
			});

			expect(created.slug).toBe(slugify(title));
		});
	});

	it("reports a collision on a chosen slug instead of deduplicating it", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getEntityTypeId(tx, "news");
			const requestedSlug = slugify(uniqueTitle());

			await createDraftDocumentWithSlug(tx, typeId, { requestedSlug, title: uniqueTitle() });

			await expect(
				createDraftDocumentWithSlug(tx, typeId, { requestedSlug, title: uniqueTitle() }),
			).rejects.toThrow();
		});
	});
});

describe("updateDraftDocumentSlug", () => {
	/** Publishing needs the subtype row the adapter clones, so seed a real person. */
	async function seedPerson(tx: Tx, title: string): Promise<{ documentId: string; slug: string }> {
		const typeId = await getEntityTypeId(tx, "persons");
		const { documentId, versionId, slug } = await createDraftDocumentFromTitle(tx, typeId, title);
		await tx.insert(schema.persons).values({ id: versionId, name: title, sortName: title });

		return { documentId, slug };
	}

	it("renames a document that has never been published", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedPerson(tx, uniqueTitle());
			const renamed = slugify(uniqueTitle());

			await updateDraftDocumentSlug(tx, documentId, renamed);

			const [row] = await tx
				.select({ slug: schema.slugs.value })
				.from(schema.slugs)
				.where(eq(schema.slugs.entityId, documentId));
			expect(row?.slug).toBe(renamed);
		});
	});

	/**
	 * A published slug is a live URL: renaming it needs the redirect + index cleanup that only the
	 * maintenance slug editor performs. The form hides the field, but a forged submission must not
	 * get through either.
	 */
	it("refuses to rename a published document", async () => {
		await withTransaction(async (tx) => {
			const { documentId } = await seedPerson(tx, uniqueTitle());
			await publishVersion(tx, documentId, personsLifecycleAdapter);

			// A typed error the action wrappers translate to a specific message, not a generic 500.
			await expect(
				updateDraftDocumentSlug(tx, documentId, slugify(uniqueTitle())),
			).rejects.toBeInstanceOf(UserFacingError);
		});
	});

	it("accepts the unchanged slug of a published document, since that is not a rename", async () => {
		await withTransaction(async (tx) => {
			const { documentId, slug } = await seedPerson(tx, uniqueTitle());
			await publishVersion(tx, documentId, personsLifecycleAdapter);

			await expect(updateDraftDocumentSlug(tx, documentId, slug)).resolves.toBeUndefined();
		});
	});
});
