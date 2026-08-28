import { randomUUID } from "node:crypto";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import slugify from "@sindresorhus/slugify";

import type { Transaction } from "@/lib/db";
import { and, asc, eq, inArray, or } from "@/lib/db/sql";
import { assertSlugWithinMaxLength, maxSlugLength, truncateSlug } from "@/lib/slug";
import { UserFacingError } from "@/lib/user-facing-error";

export interface DocumentVersion {
	documentId: string;
	versionId: string;
}

/**
 * A freshly inserted document. `slug` is the value the database actually stored, which callers must
 * use in preference to re-deriving it from the title: it is the only source that stays correct once
 * a requested slug is adjusted to keep `(type, slug)` unique.
 */
export interface CreatedDocument extends DocumentVersion {
	slug: string;
}

export interface DocumentVersions {
	draftId: string | null;
	publishedId: string | null;
}

export interface DocumentLifecycleState extends DocumentVersions {
	hasDraftChanges: boolean;
}

/**
 * Adapter that each entity type must implement to participate in the lifecycle.
 *
 * The generic helpers (ensureDraftVersion, publishVersion, discardDraftVersion) own the
 * entity_versions row, fields, content blocks, and document-level relations. The adapter owns the
 * type-specific subtype table row and any child rows it controls directly (e.g. gallery items live
 * under the content-block layer and are handled by the generic clone, but a subtype-specific join
 * table like impactCaseStudiesToPersons is the adapter's responsibility).
 */
export interface EntityLifecycleAdapter {
	/**
	 * Copy the subtype row (and any subtype-owned children) from sourceVersionId to targetVersionId.
	 * targetVersionId already exists as an entity_versions row.
	 */
	cloneSubtype(tx: Transaction, sourceVersionId: string, targetVersionId: string): Promise<void>;

	/**
	 * Replace subtype-owned rows for an existing target version from a source version. Adapters can
	 * override this when replacement must preserve rows owned by other versions.
	 */
	replaceSubtype?(tx: Transaction, sourceVersionId: string, targetVersionId: string): Promise<void>;

	/**
	 * Delete the subtype row (and any subtype-owned children) for versionId, in preparation for it
	 * being overwritten. Do NOT delete the entity_versions row itself — the caller does that.
	 */
	wipeSubtype(tx: Transaction, versionId: string): Promise<void>;
}

/**
 * Strip the per-version primary key and timestamps from a subtype row, leaving the copyable version
 * payload. Adapters read the whole source row (`.select()` with no argument, so newly added columns
 * are carried automatically) and spread this payload onto the target version — guarding against the
 * bug class where a hardcoded `.select({...})` list silently drops a new column on publish.
 *
 * - `id` is the per-version PK and must be re-assigned to the target version by the caller.
 * - `createdAt`/`updatedAt` come from `f.timestamps()`; version timing lives on `entity_versions`
 *   (see `setVersionUpdatedAt`), not on the subtype row, so they are never copied across versions.
 */
export function subtypePayload<T extends { id: unknown; createdAt: unknown; updatedAt: unknown }>(
	row: T,
): Omit<T, "id" | "createdAt" | "updatedAt"> {
	const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = row;
	return rest;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function createVersionRow(
	tx: Transaction,
	documentId: string,
	statusType: "draft" | "published",
	localeId: string,
): Promise<string> {
	const status = await tx.query.entityStatus.findFirst({
		where: { type: statusType },
		columns: { id: true },
	});
	assert(status, `Entity status "${statusType}" not found in database.`);

	const [version] = await tx
		.insert(schema.entityVersions)
		.values({ entityId: documentId, statusId: status.id, localeId })
		.returning({ id: schema.entityVersions.id });
	assert(version);

	return version.id;
}

async function getDefaultLocaleId(tx: Transaction): Promise<string> {
	const locale = await tx.query.locales.findFirst({
		where: { isDefault: true },
		columns: { id: true },
	});
	assert(locale, "Default locale not found in database.");
	return locale.id;
}

/**
 * Copy the slug row from sourceVersionId to targetVersionId, if one exists. `localeId` defaults to
 * the source row's own locale — pass it explicitly when cloning across locales (seeding a new
 * translation), since the new slug row must belong to the target locale, not the source's.
 */
async function cloneSlugRow(
	tx: Transaction,
	sourceVersionId: string,
	targetVersionId: string,
	isPublished: boolean,
	localeId?: string,
): Promise<void> {
	const source = await tx.query.slugs.findFirst({
		where: { entityVersionId: sourceVersionId },
	});
	if (source == null) {
		return;
	}

	await tx.insert(schema.slugs).values({
		entityVersionId: targetVersionId,
		entityId: source.entityId,
		typeId: source.typeId,
		localeId: localeId ?? source.localeId,
		value: source.value,
		isPublished,
	});
}

/** Sync the published slug's value from the draft's slug, in case it was edited on the draft. */
async function syncSlugValue(
	tx: Transaction,
	draftVersionId: string,
	publishedVersionId: string,
): Promise<void> {
	const draftSlug = await tx.query.slugs.findFirst({
		where: { entityVersionId: draftVersionId },
		columns: { value: true },
	});
	if (draftSlug == null) {
		return;
	}

	await tx
		.update(schema.slugs)
		.set({ value: draftSlug.value })
		.where(eq(schema.slugs.entityVersionId, publishedVersionId));
}

async function setVersionUpdatedAt(
	tx: Transaction,
	versionId: string,
	updatedAt: Date,
): Promise<void> {
	await tx
		.update(schema.entityVersions)
		.set({ updatedAt })
		.where(eq(schema.entityVersions.id, versionId));
}

async function cloneTypedContentBlock(
	tx: Transaction,
	sourceBlockId: string,
	targetBlockId: string,
	typeName: schema.ContentBlockTypes["type"],
): Promise<void> {
	switch (typeName) {
		case "callout": {
			const [source] = await tx
				.select({
					intent: schema.calloutContentBlocks.intent,
					title: schema.calloutContentBlocks.title,
				})
				.from(schema.calloutContentBlocks)
				.where(eq(schema.calloutContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.calloutContentBlocks).values({ id: targetBlockId, ...source });
			break;
		}

		case "rich_text": {
			const [source] = await tx
				.select({ content: schema.richTextContentBlocks.content })
				.from(schema.richTextContentBlocks)
				.where(eq(schema.richTextContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx
				.insert(schema.richTextContentBlocks)
				.values({ id: targetBlockId, content: source.content });
			break;
		}

		case "image": {
			const [source] = await tx
				.select({
					imageId: schema.imageContentBlocks.imageId,
					caption: schema.imageContentBlocks.caption,
					captionMode: schema.imageContentBlocks.captionMode,
					layout: schema.imageContentBlocks.layout,
				})
				.from(schema.imageContentBlocks)
				.where(eq(schema.imageContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.imageContentBlocks).values({ id: targetBlockId, ...source });
			break;
		}

		case "data": {
			const [source] = await tx
				.select({
					typeId: schema.dataContentBlocks.typeId,
					limit: schema.dataContentBlocks.limit,
					selectedIds: schema.dataContentBlocks.selectedIds,
				})
				.from(schema.dataContentBlocks)
				.where(eq(schema.dataContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.dataContentBlocks).values({ id: targetBlockId, ...source });
			break;
		}

		case "embed": {
			const [source] = await tx
				.select({
					url: schema.embedContentBlocks.url,
					title: schema.embedContentBlocks.title,
					caption: schema.embedContentBlocks.caption,
				})
				.from(schema.embedContentBlocks)
				.where(eq(schema.embedContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.embedContentBlocks).values({ id: targetBlockId, ...source });
			break;
		}

		case "hero": {
			const [source] = await tx
				.select({
					title: schema.heroContentBlocks.title,
					eyebrow: schema.heroContentBlocks.eyebrow,
					imageId: schema.heroContentBlocks.imageId,
					caption: schema.heroContentBlocks.caption,
					captionMode: schema.heroContentBlocks.captionMode,
					ctas: schema.heroContentBlocks.ctas,
				})
				.from(schema.heroContentBlocks)
				.where(eq(schema.heroContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.heroContentBlocks).values({ id: targetBlockId, ...source });
			break;
		}

		// An accordion is nothing but its panels, and a panel nothing but a title and its blocks — the
		// children are cloned by the walk in `cloneVersionContent`, not from here.
		case "accordion": {
			const [source] = await tx
				.select({ id: schema.accordionContentBlocks.id })
				.from(schema.accordionContentBlocks)
				.where(eq(schema.accordionContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.accordionContentBlocks).values({ id: targetBlockId });
			break;
		}

		case "accordion_item": {
			const [source] = await tx
				.select({ title: schema.accordionItemContentBlocks.title })
				.from(schema.accordionItemContentBlocks)
				.where(eq(schema.accordionItemContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.accordionItemContentBlocks).values({ id: targetBlockId, ...source });
			break;
		}

		case "gallery": {
			const [source] = await tx
				.select({
					layout: schema.galleryContentBlocks.layout,
					caption: schema.galleryContentBlocks.caption,
				})
				.from(schema.galleryContentBlocks)
				.where(eq(schema.galleryContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.galleryContentBlocks).values({ id: targetBlockId, ...source });

			const items = await tx
				.select({
					imageId: schema.galleryContentBlockItems.imageId,
					position: schema.galleryContentBlockItems.position,
					caption: schema.galleryContentBlockItems.caption,
					captionMode: schema.galleryContentBlockItems.captionMode,
				})
				.from(schema.galleryContentBlockItems)
				.where(eq(schema.galleryContentBlockItems.galleryContentBlockId, sourceBlockId))
				.orderBy(asc(schema.galleryContentBlockItems.position));

			if (items.length > 0) {
				await tx.insert(schema.galleryContentBlockItems).values(
					items.map((item) => {
						return { ...item, galleryContentBlockId: targetBlockId };
					}),
				);
			}
			break;
		}

		case "media_text": {
			const [source] = await tx
				.select({
					imageId: schema.mediaTextContentBlocks.imageId,
					side: schema.mediaTextContentBlocks.side,
					content: schema.mediaTextContentBlocks.content,
					caption: schema.mediaTextContentBlocks.caption,
					captionMode: schema.mediaTextContentBlocks.captionMode,
				})
				.from(schema.mediaTextContentBlocks)
				.where(eq(schema.mediaTextContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.mediaTextContentBlocks).values({ id: targetBlockId, ...source });
			break;
		}
	}
}

/**
 * Copy all fields and content blocks (including all typed block variants) from one entity version
 * to another. Does not touch the subtype row — that is the adapter's responsibility.
 *
 * Everything copied here is keyed by version id alone, so source and target may belong to different
 * documents — `duplicateEntity` relies on that to seed a clone's draft from the source's version.
 */
export async function cloneVersionContent(
	tx: Transaction,
	sourceVersionId: string,
	targetVersionId: string,
): Promise<void> {
	const sourceFields = await tx
		.select({ id: schema.fields.id, fieldNameId: schema.fields.fieldNameId })
		.from(schema.fields)
		.where(eq(schema.fields.entityVersionId, sourceVersionId));

	for (const sourceField of sourceFields) {
		const [targetField] = await tx
			.insert(schema.fields)
			.values({ entityVersionId: targetVersionId, fieldNameId: sourceField.fieldNameId })
			.returning({ id: schema.fields.id });
		assert(targetField);

		// The field's whole tree in one query — a nested block carries the same `field_id` as the
		// container it sits in — then walked top-down, because a child's `parent_block_id` has to name
		// the copy of its container rather than the original.
		const blocks = await tx
			.select({
				id: schema.contentBlocks.id,
				typeId: schema.contentBlocks.typeId,
				typeName: schema.contentBlockTypes.type,
				parentBlockId: schema.contentBlocks.parentBlockId,
				position: schema.contentBlocks.position,
			})
			.from(schema.contentBlocks)
			.innerJoin(
				schema.contentBlockTypes,
				eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
			)
			.where(eq(schema.contentBlocks.fieldId, sourceField.id))
			.orderBy(asc(schema.contentBlocks.position));

		const blocksByParent = new Map<string | null, typeof blocks>();
		for (const block of blocks) {
			const siblings = blocksByParent.get(block.parentBlockId) ?? [];
			siblings.push(block);
			blocksByParent.set(block.parentBlockId, siblings);
		}

		const targetFieldId = targetField.id;

		async function cloneLevel(
			sourceParentBlockId: string | null,
			targetParentBlockId: string | null,
		): Promise<void> {
			for (const block of blocksByParent.get(sourceParentBlockId) ?? []) {
				const inserted: Array<{ id: string }> = await tx
					.insert(schema.contentBlocks)
					.values({
						fieldId: targetFieldId,
						typeId: block.typeId,
						parentBlockId: targetParentBlockId,
						position: block.position,
					})
					.returning({ id: schema.contentBlocks.id });
				const targetBlock: { id: string } | undefined = inserted[0];
				assert(targetBlock);

				await cloneTypedContentBlock(tx, block.id, targetBlock.id, block.typeName);
				await cloneLevel(block.id, targetBlock.id);
			}
		}

		await cloneLevel(null, null);
	}
}

/**
 * Delete all fields and content blocks owned by a version. Typed content block rows cascade
 * automatically when content_blocks rows are deleted. Does NOT delete the entity_versions row
 * itself.
 */
async function wipeVersionContent(tx: Transaction, versionId: string): Promise<void> {
	const fieldRows = await tx
		.select({ id: schema.fields.id })
		.from(schema.fields)
		.where(eq(schema.fields.entityVersionId, versionId));

	if (fieldRows.length > 0) {
		const fieldIds = fieldRows.map((f) => f.id);
		await tx.delete(schema.contentBlocks).where(inArray(schema.contentBlocks.fieldId, fieldIds));
		await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Insert a new document + published version row. Subtype rows should be inserted with `id:
 * versionId`. Cross-document relations should reference `documentId`.
 */
export async function createPublishedDocument(
	tx: Transaction,
	typeId: string,
	slug: string,
): Promise<DocumentVersion> {
	const [document] = await tx
		.insert(schema.entities)
		.values({ typeId })
		.returning({ id: schema.entities.id });
	assert(document);

	const localeId = await getDefaultLocaleId(tx);
	const versionId = await createVersionRow(tx, document.id, "published", localeId);

	await tx.insert(schema.slugs).values({
		entityVersionId: versionId,
		entityId: document.id,
		typeId,
		localeId,
		value: slug,
		isPublished: true,
	});

	return { documentId: document.id, versionId };
}

const maxSlugAttempts = 50;

/**
 * The longest suffix `insertDocumentWithFreeSlug` can append (`-50`, for `maxSlugAttempts`).
 * Derived base slugs hold this many bytes back, so deduplicating one that was truncated to the
 * limit cannot push it past the limit again.
 */
const maxSlugSuffixLength = `-${String(maxSlugAttempts)}`.length;

/**
 * Insert a document + draft version under `baseSlug`, falling back to `<baseSlug>-2`, `-3`, … while
 * a slug for the type/locale already uses the candidate.
 *
 * Only _published_ slugs carry a database uniqueness constraint
 * (`slugs_published_type_locale_value_unique`, scoped to `(type, locale, value) WHERE
 * is_published`) — a draft slug has none of its own, since two drafts sharing a value is harmless
 * until one of them publishes. So collisions are checked explicitly here with a `SELECT` rather
 * than caught from a unique-violation, unlike the old single-`entities.slug`-column scheme this
 * replaced. The check has a narrow race window, but a title-derived collision is rare enough (and
 * harmless pre-publish) that this is an acceptable tradeoff against the complexity of a stricter
 * scheme.
 */
async function insertDocumentWithFreeSlug(
	tx: Transaction,
	typeId: string,
	baseSlug: string,
): Promise<CreatedDocument> {
	const localeId = await getDefaultLocaleId(tx);

	for (let attempt = 1; attempt <= maxSlugAttempts; attempt++) {
		const candidate = attempt === 1 ? baseSlug : `${baseSlug}-${String(attempt)}`;

		const existing = await tx.query.slugs.findFirst({
			where: { typeId, localeId, value: candidate },
			columns: { id: true },
		});
		if (existing != null) {
			continue;
		}

		const [document] = await tx
			.insert(schema.entities)
			.values({ typeId })
			.returning({ id: schema.entities.id });
		assert(document);

		const versionId = await createVersionRow(tx, document.id, "draft", localeId);

		await tx.insert(schema.slugs).values({
			entityVersionId: versionId,
			entityId: document.id,
			typeId,
			localeId,
			value: candidate,
			isPublished: false,
		});

		return { documentId: document.id, versionId, slug: candidate };
	}

	throw new Error(`Could not derive a free slug for "${baseSlug}".`);
}

/**
 * A base slug for a title the slugifier reduces to nothing — one written entirely in a script it
 * does not transliterate (CJK), or made only of punctuation.
 *
 * Such a title would otherwise store an empty slug, leaving the entity on an unreachable
 * `/<type>//details` URL. The entity matters more here than the prettiness of its slug, so fall
 * back to a meaningless but valid one the user can correct afterwards. The random token keeps
 * concurrent creates from queueing up behind a shared `<type>`, `<type>-2`, … chain.
 */
async function createFallbackSlug(tx: Transaction, typeId: string): Promise<string> {
	const entityType = await tx.query.entityTypes.findFirst({
		where: { id: typeId },
		columns: { type: true },
	});
	assert(entityType, `Entity type "${typeId}" not found in database.`);

	return `${entityType.type}-${randomUUID().slice(0, 8)}`;
}

/**
 * Insert a new document + draft version row, under a slug derived from the entity's title.
 *
 * Prefer this to `createDraftDocument` wherever the slug is derived rather than chosen: a title
 * clash must not fail the create, because the user cannot see the slug field and so has no way to
 * act on the error beyond rewording an otherwise valid title. A slug the user _did_ choose keeps
 * the opposite handling — see `createDraftDocument`.
 *
 * A very long title is treated the same way: the derived slug is cut to `maxSlugLength` rather than
 * refused, since the length of a URL segment is not something the title's author is asked about.
 */
export async function createDraftDocumentFromTitle(
	tx: Transaction,
	typeId: string,
	title: string,
): Promise<CreatedDocument> {
	const derivedSlug = truncateSlug(slugify(title), maxSlugLength - maxSlugSuffixLength);
	const baseSlug = derivedSlug === "" ? await createFallbackSlug(tx, typeId) : derivedSlug;

	return insertDocumentWithFreeSlug(tx, typeId, baseSlug);
}

/**
 * Insert a new document + draft version row under an exact slug. Subtype rows should be inserted
 * with `id: versionId`. Cross-document relations should reference `documentId`.
 *
 * A slug already in use for the type/locale — draft or published — is rejected with
 * `UserFacingError("entity-slug-conflict")`. Checked explicitly with a `SELECT`, the same way
 * `insertDocumentWithFreeSlug` checks a derived candidate:
 * `slugs_published_type_locale_value_unique` only applies `WHERE is_published`, and the row this
 * inserts is a draft's — never published — so it can never trip that constraint no matter what
 * value collides, published or draft. The difference from `insertDocumentWithFreeSlug` is only in
 * the response — reject outright rather than retry under a suffix — which is the right handling for
 * a slug a user actually chose; for one derived from a title, use `createDraftDocumentFromTitle`.
 */
export async function createDraftDocument(
	tx: Transaction,
	typeId: string,
	slug: string,
): Promise<CreatedDocument> {
	assertSlugWithinMaxLength(slug);

	const localeId = await getDefaultLocaleId(tx);

	const existing = await tx.query.slugs.findFirst({
		where: { typeId, localeId, value: slug },
		columns: { id: true },
	});
	if (existing != null) {
		throw new UserFacingError("entity-slug-conflict");
	}

	const [document] = await tx
		.insert(schema.entities)
		.values({ typeId })
		.returning({ id: schema.entities.id });
	assert(document);

	const versionId = await createVersionRow(tx, document.id, "draft", localeId);

	await tx.insert(schema.slugs).values({
		entityVersionId: versionId,
		entityId: document.id,
		typeId,
		localeId,
		value: slug,
		isPublished: false,
	});

	return { documentId: document.id, versionId, slug };
}

/**
 * Insert a new document + draft version row, under the slug the user chose, or one derived from the
 * title when they left the slug field empty.
 *
 * The single place the create forms express the rule that governs slugs: a slug the user chose is
 * held to a collision error (`createDraftDocument`), a derived one is quietly deduplicated
 * (`createDraftDocumentFromTitle`). Pass `requestedSlug: null` for the empty field — never an empty
 * string, which would read as a choice.
 */
export async function createDraftDocumentWithSlug(
	tx: Transaction,
	typeId: string,
	options: { requestedSlug: string | null; title: string },
): Promise<CreatedDocument> {
	const { requestedSlug, title } = options;

	return requestedSlug != null
		? createDraftDocument(tx, typeId, requestedSlug)
		: createDraftDocumentFromTitle(tx, typeId, title);
}

/**
 * The document's current slug: the draft's when one exists (forms edit the draft), else the
 * published slug.
 */
export async function getDocumentSlug(tx: Transaction, documentId: string): Promise<string> {
	const { draftId, publishedId } = await getDocumentVersions(tx, documentId);
	const versionId = draftId ?? publishedId;
	assert(versionId, `Entity "${documentId}" not found.`);

	const [row] = await tx
		.select({ slug: schema.slugs.value })
		.from(schema.slugs)
		.where(eq(schema.slugs.entityVersionId, versionId))
		.limit(1);
	assert(row, `Slug not found for entity version "${versionId}".`);
	return row.slug;
}

/** Return the draft and published version IDs for a document (either may be null). */
export async function getDocumentVersions(
	tx: Transaction,
	documentId: string,
): Promise<DocumentVersions> {
	const row = await tx
		.select({
			draftId: schema.documentLifecycle.draftId,
			publishedId: schema.documentLifecycle.publishedId,
		})
		.from(schema.documentLifecycle)
		.where(eq(schema.documentLifecycle.documentId, documentId))
		.then((rows) => rows[0]);

	return { draftId: row?.draftId ?? null, publishedId: row?.publishedId ?? null };
}

/**
 * Apply a user-chosen slug to a document that has never been published.
 *
 * Renaming a draft is the safe case: it has no public URL yet, so nothing can break. A published
 * document's slug _is_ a live URL, and changing it needs the redirect and search-index cleanup the
 * maintenance slug editor performs — which is why that stays an admin task and out of the entity
 * forms. The published check is enforced here rather than in the form, so a forged submission
 * cannot rename a live page.
 *
 * The slug is taken verbatim: the user chose it, so a collision raises
 * `entities_type_id_slug_unique` and is reported to them, never deduplicated behind their back.
 */
export async function updateDraftDocumentSlug(
	tx: Transaction,
	documentId: string,
	slug: string,
): Promise<void> {
	const currentSlug = await getDocumentSlug(tx, documentId);

	// Resubmitting the unchanged slug is what every ordinary save does; only an actual rename has to
	// clear the published check.
	if (currentSlug === slug) {
		return;
	}

	// Checked only for an actual rename, so re-saving a document that already holds an over-long slug
	// is not blocked by a value it is not changing.
	assertSlugWithinMaxLength(slug);

	const { draftId, publishedId } = await getDocumentVersions(tx, documentId);
	if (publishedId != null) {
		// Reached only by a forged submission or a publish that raced this save — the form hides the
		// field once published. A typed error so the action shows "change it on Maintenance" instead of
		// a generic 500.
		throw new UserFacingError("published-slug-rename");
	}
	assert(draftId, `Document "${documentId}" has no draft version to rename.`);

	await tx
		.update(schema.slugs)
		.set({ value: slug })
		.where(eq(schema.slugs.entityVersionId, draftId));
}

/** Return lifecycle state while treating a synced draft clone as "no draft changes". */
export async function getDocumentLifecycleState(
	tx: Transaction,
	documentId: string,
): Promise<DocumentLifecycleState> {
	const row = await tx
		.select({
			draftId: schema.documentLifecycle.draftId,
			publishedId: schema.documentLifecycle.publishedId,
			hasDraftChanges: schema.documentLifecycle.hasDraftChanges,
		})
		.from(schema.documentLifecycle)
		.where(eq(schema.documentLifecycle.documentId, documentId))
		.then((rows) => rows[0]);

	return {
		draftId: row?.draftId ?? null,
		publishedId: row?.publishedId ?? null,
		hasDraftChanges: row?.hasDraftChanges ?? false,
	};
}

/**
 * Same as {@link getDocumentLifecycleState}, but for an arbitrary locale rather than the default
 * one `document_lifecycle` is pinned to. Queries `entity_versions` directly since the view cannot
 * help here.
 */
export async function getDocumentLifecycleStateForLocale(
	tx: Transaction,
	documentId: string,
	localeId: string,
): Promise<DocumentLifecycleState> {
	const rows = await tx
		.select({
			id: schema.entityVersions.id,
			status: schema.entityStatus.type,
			updatedAt: schema.entityVersions.updatedAt,
		})
		.from(schema.entityVersions)
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.where(
			and(
				eq(schema.entityVersions.entityId, documentId),
				eq(schema.entityVersions.localeId, localeId),
			),
		);

	const draft = rows.find((row) => row.status === "draft") ?? null;
	const published = rows.find((row) => row.status === "published") ?? null;
	const hasDraftChanges =
		draft != null && (published == null || draft.updatedAt > published.updatedAt);

	return {
		draftId: draft?.id ?? null,
		publishedId: published?.id ?? null,
		hasDraftChanges,
	};
}

/**
 * Return the draft version ID for `documentId`, creating one if it does not exist yet. When
 * creating, clones fields, content blocks, and subtype data from the published version (if one
 * exists).
 *
 * Returns the draft version ID.
 */
export async function ensureDraftVersion(
	tx: Transaction,
	documentId: string,
	adapter: EntityLifecycleAdapter,
): Promise<string> {
	const { draftId, publishedId } = await getDocumentVersions(tx, documentId);

	if (draftId != null) {
		return draftId;
	}

	let publishedVersion: { updatedAt: Date; localeId: string } | undefined;
	if (publishedId != null) {
		publishedVersion = await tx.query.entityVersions.findFirst({
			where: { id: publishedId },
			columns: { updatedAt: true, localeId: true },
		});
		assert(publishedVersion, `Published version "${publishedId}" not found in database.`);
	}

	const localeId = publishedVersion?.localeId ?? (await getDefaultLocaleId(tx));
	const newDraftId = await createVersionRow(tx, documentId, "draft", localeId);

	if (publishedId != null) {
		assert(publishedVersion);
		await cloneVersionContent(tx, publishedId, newDraftId);
		await adapter.cloneSubtype(tx, publishedId, newDraftId);
		await cloneSlugRow(tx, publishedId, newDraftId, false);
		await setVersionUpdatedAt(tx, newDraftId, publishedVersion.updatedAt);
	}

	return newDraftId;
}

export interface LocalizedDraftVersion {
	versionId: string;
	/** True when this locale had no version at all and a first translation draft was just seeded. */
	isNewTranslation: boolean;
}

/**
 * Locale-aware {@link ensureDraftVersion}. Returns the draft version ID for `documentId` in
 * `localeId`, creating one if it does not exist yet:
 *
 * - If `localeId` already has a draft: returns it as-is.
 * - If `localeId` has a published version but no draft: clones a new draft from it, same as
 *   `ensureDraftVersion`.
 * - If `localeId` has no version at all yet: seeds a first-translation draft cloned from the default
 *   locale's latest editable version (draft, else published) — this is the only case where the
 *   source and target versions belong to different locales.
 *
 * Mirrors `ensureDraftVersion`'s implicit-create-on-visit behavior; there is no separate "start
 * translation" confirmation step. Asserts the document has a default-locale version to translate
 * from — callers should not reach the no-version-at-all branch for a document that hasn't been
 * created in the default locale yet.
 */
export async function ensureLocalizedDraftVersion(
	tx: Transaction,
	documentId: string,
	adapter: EntityLifecycleAdapter,
	localeId: string,
): Promise<LocalizedDraftVersion> {
	const { draftId, publishedId } = await getDocumentLifecycleStateForLocale(
		tx,
		documentId,
		localeId,
	);

	if (draftId != null) {
		return { versionId: draftId, isNewTranslation: false };
	}

	if (publishedId != null) {
		const publishedVersion = await tx.query.entityVersions.findFirst({
			where: { id: publishedId },
			columns: { updatedAt: true },
		});
		assert(publishedVersion, `Published version "${publishedId}" not found in database.`);

		const newDraftId = await createVersionRow(tx, documentId, "draft", localeId);
		await cloneVersionContent(tx, publishedId, newDraftId);
		await adapter.cloneSubtype(tx, publishedId, newDraftId);
		await cloneSlugRow(tx, publishedId, newDraftId, false);
		await setVersionUpdatedAt(tx, newDraftId, publishedVersion.updatedAt);

		return { versionId: newDraftId, isNewTranslation: false };
	}

	const defaultLocaleId = await getDefaultLocaleId(tx);
	const defaultLocaleState = await getDocumentLifecycleStateForLocale(
		tx,
		documentId,
		defaultLocaleId,
	);
	const sourceVersionId = defaultLocaleState.draftId ?? defaultLocaleState.publishedId;
	assert(
		sourceVersionId,
		`Document "${documentId}" has no version in the default locale to translate from.`,
	);

	const newDraftId = await createVersionRow(tx, documentId, "draft", localeId);
	await cloneVersionContent(tx, sourceVersionId, newDraftId);
	await adapter.cloneSubtype(tx, sourceVersionId, newDraftId);
	await cloneSlugRow(tx, sourceVersionId, newDraftId, false, localeId);

	return { versionId: newDraftId, isNewTranslation: true };
}

/**
 * Promote the draft version of `documentId` to published.
 *
 * - If no published version exists yet: creates a new published version row and copies content from
 *   draft.
 * - If a published version already exists: wipes its content and replaces it with the draft content
 *   (the published version ID is stable across republishes).
 *
 * Returns the published version ID. Asserts that a draft version exists — callers should ensure one
 * is present.
 */
export async function publishVersion(
	tx: Transaction,
	documentId: string,
	adapter: EntityLifecycleAdapter,
): Promise<string> {
	const { draftId, publishedId } = await getDocumentVersions(tx, documentId);
	assert(draftId, "Cannot publish: no draft version exists for this document.");
	const draftVersion = await tx.query.entityVersions.findFirst({
		where: { id: draftId },
		columns: { updatedAt: true, localeId: true },
	});
	assert(draftVersion, `Draft version "${draftId}" not found in database.`);

	if (publishedId == null) {
		const newPublishedId = await createVersionRow(
			tx,
			documentId,
			"published",
			draftVersion.localeId,
		);
		await cloneVersionContent(tx, draftId, newPublishedId);
		await adapter.cloneSubtype(tx, draftId, newPublishedId);
		await cloneSlugRow(tx, draftId, newPublishedId, true);
		await setVersionUpdatedAt(tx, newPublishedId, draftVersion.updatedAt);
		return newPublishedId;
	}

	// Replace published content in place (stable published ID).
	await wipeVersionContent(tx, publishedId);
	await cloneVersionContent(tx, draftId, publishedId);
	if (adapter.replaceSubtype != null) {
		await adapter.replaceSubtype(tx, draftId, publishedId);
	} else {
		await adapter.wipeSubtype(tx, publishedId);
		await adapter.cloneSubtype(tx, draftId, publishedId);
	}
	await syncSlugValue(tx, draftId, publishedId);
	await setVersionUpdatedAt(tx, publishedId, draftVersion.updatedAt);

	return publishedId;
}

export async function touchVersion(
	tx: Transaction,
	versionId: string,
	updatedAt: Date = new Date(),
): Promise<void> {
	await setVersionUpdatedAt(tx, versionId, updatedAt);
}

/** Delete the draft version of `documentId` (if one exists). Does not affect the published version. */
export async function discardDraftVersion(
	tx: Transaction,
	documentId: string,
	adapter: EntityLifecycleAdapter,
): Promise<void> {
	const { draftId, publishedId } = await getDocumentVersions(tx, documentId);
	if (draftId == null) {
		return;
	}

	await adapter.wipeSubtype(tx, draftId);

	// A never-published document has no published version to revert to, so discarding its only draft
	// removes the whole document — including its document-level relations. Otherwise the `entities` row
	// would survive with no version (`document_lifecycle` is a view derived from `entity_versions`),
	// leaving e.g. a person↔unit relation pointing at a versionless "ghost" document.
	if (publishedId == null) {
		// This branch deletes the document itself, so it needs the same refusal the delete actions get.
		await assertDocumentNotLinkedToUser(tx, documentId);
		await deleteDocumentVersionTail(tx, draftId, documentId);
		return;
	}

	await wipeVersionContent(tx, draftId);
	await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, draftId));
	await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, draftId));
}

/** Look up the owning documentId (= entities.id) for a given entity_version row. */
export async function getDocumentIdForVersion(tx: Transaction, versionId: string): Promise<string> {
	const v = await tx.query.entityVersions.findFirst({
		where: { id: versionId },
		columns: { entityId: true },
	});
	assert(v);
	return v.entityId;
}

/**
 * Refuses to delete a document that a user account still names as its actor.
 *
 * `users.person_document_id` / `users.organisational_unit_document_id` reference `entities.id`
 * without `ON DELETE CASCADE`, so the delete would fail anyway — but on the raw foreign-key
 * violation, which reads to the admin as "a related record no longer exists. Refresh the page and
 * try again". Refreshing cannot help: the problem is a record that still exists.
 *
 * Refusing rather than unlinking is deliberate. The actor link is what `lib/auth/permissions.ts`
 * derives national-coordinator and working-group-chair authority from, so clearing it silently
 * would revoke a user's access as a side effect of tidying up an entity. The admin has to decide
 * what that user's link should become.
 *
 * Called from every document delete: the columns are plain `entities` references, so nothing but
 * this check keeps a link to a type the user form does not currently offer from behaving
 * differently.
 */
export async function assertDocumentNotLinkedToUser(
	tx: Transaction,
	documentId: string,
): Promise<void> {
	const [linkedUser] = await tx
		.select({ id: schema.users.id })
		.from(schema.users)
		.where(
			or(
				eq(schema.users.personDocumentId, documentId),
				eq(schema.users.organisationalUnitDocumentId, documentId),
			),
		)
		.limit(1);

	if (linkedUser != null) {
		throw new UserFacingError("document-linked-to-user");
	}
}

/**
 * Delete every document-level relation in which `documentId` is an endpoint. These relations are
 * keyed by `entities.id` and the FKs have no `ON DELETE CASCADE`, so they must be removed before
 * deleting the `entities` row — otherwise the delete aborts with a foreign-key violation. Reporting
 * org refs (country/working-group reports, institutions, thresholds) are intentionally NOT removed
 * here: like before this migration, a report blocks deletion of the org unit it is about; reports
 * are removed only by their own delete actions.
 */
export async function deleteDocumentRelations(tx: Transaction, documentId: string): Promise<void> {
	// Person↔org relations reference this document on either endpoint. Remove their report references
	// first (no ON DELETE CASCADE), then the relation rows themselves.
	const personOrgRelations = await tx
		.select({ id: schema.personsToOrganisationalUnits.id })
		.from(schema.personsToOrganisationalUnits)
		.where(
			or(
				eq(schema.personsToOrganisationalUnits.personDocumentId, documentId),
				eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, documentId),
			),
		);

	if (personOrgRelations.length > 0) {
		const relationIds = personOrgRelations.map((r) => r.id);
		await tx
			.delete(schema.countryReportContributions)
			.where(inArray(schema.countryReportContributions.personToOrgUnitId, relationIds));
		await tx
			.delete(schema.personsToOrganisationalUnits)
			.where(inArray(schema.personsToOrganisationalUnits.id, relationIds));
	}

	// Project↔org relations reference this document on either endpoint.
	await tx
		.delete(schema.projectsToOrganisationalUnits)
		.where(
			or(
				eq(schema.projectsToOrganisationalUnits.projectDocumentId, documentId),
				eq(schema.projectsToOrganisationalUnits.unitDocumentId, documentId),
			),
		);

	// Unit↔unit relations reference this document on either endpoint.
	await tx
		.delete(schema.organisationalUnitsRelations)
		.where(
			or(
				eq(schema.organisationalUnitsRelations.unitDocumentId, documentId),
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, documentId),
			),
		);

	// Article contributors reference this document as either the article or the person.
	await tx
		.delete(schema.impactCaseStudiesToPersons)
		.where(
			or(
				eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, documentId),
				eq(schema.impactCaseStudiesToPersons.personDocumentId, documentId),
			),
		);

	await tx
		.delete(schema.spotlightArticlesToPersons)
		.where(
			or(
				eq(schema.spotlightArticlesToPersons.spotlightArticleDocumentId, documentId),
				eq(schema.spotlightArticlesToPersons.personDocumentId, documentId),
			),
		);

	// Service↔unit relations reference this document on their (versioned) unit endpoint.
	await tx
		.delete(schema.servicesToOrganisationalUnits)
		.where(eq(schema.servicesToOrganisationalUnits.organisationalUnitDocumentId, documentId));
}

/**
 * Delete the generic tail of a document: fields and content blocks under `versionId`,
 * document-level relations, cross-document relations, the version row, and the document row
 * itself.
 *
 * The subtype row must be deleted by the caller before calling this — each subtype lives in a
 * different table, and this helper does not know which.
 */
export async function deleteDocumentVersionTail(
	tx: Transaction,
	versionId: string,
	documentId: string,
): Promise<void> {
	await wipeVersionContent(tx, versionId);

	await deleteDocumentRelations(tx, documentId);

	await tx
		.delete(schema.entitiesToResources)
		.where(eq(schema.entitiesToResources.entityId, documentId));

	await tx
		.delete(schema.entitiesToEntities)
		.where(
			or(
				eq(schema.entitiesToEntities.entityId, documentId),
				eq(schema.entitiesToEntities.relatedEntityId, documentId),
			),
		);

	await tx.delete(schema.slugs).where(eq(schema.slugs.entityVersionId, versionId));
	await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, versionId));
	await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
}
