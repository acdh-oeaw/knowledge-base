import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";

import type { Transaction } from "@/lib/db";
import { asc, eq, inArray, or } from "@/lib/db/sql";

export interface DocumentVersion {
	documentId: string;
	versionId: string;
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function createVersionRow(
	tx: Transaction,
	documentId: string,
	statusType: "draft" | "published",
): Promise<string> {
	const status = await tx.query.entityStatus.findFirst({
		where: { type: statusType },
		columns: { id: true },
	});
	assert(status, `Entity status "${statusType}" not found in database.`);

	const [version] = await tx
		.insert(schema.entityVersions)
		.values({ entityId: documentId, statusId: status.id })
		.returning({ id: schema.entityVersions.id });
	assert(version);

	return version.id;
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

		case "accordion": {
			const [source] = await tx
				.select({ items: schema.accordionContentBlocks.items })
				.from(schema.accordionContentBlocks)
				.where(eq(schema.accordionContentBlocks.id, sourceBlockId))
				.limit(1);
			if (source == null) {
				return;
			}
			await tx.insert(schema.accordionContentBlocks).values({ id: targetBlockId, ...source });
			break;
		}

		case "gallery": {
			const [source] = await tx
				.select({ layout: schema.galleryContentBlocks.layout })
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
	}
}

/**
 * Copy all fields and content blocks (including all typed block variants) from one entity version
 * to another. Does not touch the subtype row — that is the adapter's responsibility.
 */
async function cloneVersionContent(
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

		const blocks = await tx
			.select({
				id: schema.contentBlocks.id,
				typeId: schema.contentBlocks.typeId,
				typeName: schema.contentBlockTypes.type,
				position: schema.contentBlocks.position,
			})
			.from(schema.contentBlocks)
			.innerJoin(
				schema.contentBlockTypes,
				eq(schema.contentBlocks.typeId, schema.contentBlockTypes.id),
			)
			.where(eq(schema.contentBlocks.fieldId, sourceField.id))
			.orderBy(asc(schema.contentBlocks.position));

		for (const block of blocks) {
			const inserted: Array<{ id: string }> = await tx
				.insert(schema.contentBlocks)
				.values({ fieldId: targetField.id, typeId: block.typeId, position: block.position })
				.returning({ id: schema.contentBlocks.id });
			const targetBlock: { id: string } | undefined = inserted[0];
			assert(targetBlock);

			await cloneTypedContentBlock(tx, block.id, targetBlock.id, block.typeName);
		}
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
		.values({ slug, typeId })
		.returning({ id: schema.entities.id });
	assert(document);

	const versionId = await createVersionRow(tx, document.id, "published");

	return { documentId: document.id, versionId };
}

/**
 * Insert a new document + draft version row. Subtype rows should be inserted with `id: versionId`.
 * Cross-document relations should reference `documentId`.
 */
export async function createDraftDocument(
	tx: Transaction,
	typeId: string,
	slug: string,
): Promise<DocumentVersion> {
	const [document] = await tx
		.insert(schema.entities)
		.values({ slug, typeId })
		.returning({ id: schema.entities.id });
	assert(document);

	const versionId = await createVersionRow(tx, document.id, "draft");

	return { documentId: document.id, versionId };
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

	const newDraftId = await createVersionRow(tx, documentId, "draft");

	if (publishedId != null) {
		await cloneVersionContent(tx, publishedId, newDraftId);
		await adapter.cloneSubtype(tx, publishedId, newDraftId);

		const publishedVersion = await tx.query.entityVersions.findFirst({
			where: { id: publishedId },
			columns: { updatedAt: true },
		});
		assert(publishedVersion, `Published version "${publishedId}" not found in database.`);
		await setVersionUpdatedAt(tx, newDraftId, publishedVersion.updatedAt);
	}

	return newDraftId;
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
		columns: { updatedAt: true },
	});
	assert(draftVersion, `Draft version "${draftId}" not found in database.`);

	if (publishedId == null) {
		const newPublishedId = await createVersionRow(tx, documentId, "published");
		await cloneVersionContent(tx, draftId, newPublishedId);
		await adapter.cloneSubtype(tx, draftId, newPublishedId);
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
	const { draftId } = await getDocumentVersions(tx, documentId);
	if (draftId == null) {
		return;
	}

	await adapter.wipeSubtype(tx, draftId);
	await wipeVersionContent(tx, draftId);
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

	await tx.delete(schema.entityVersions).where(eq(schema.entityVersions.id, versionId));
	await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));
}
