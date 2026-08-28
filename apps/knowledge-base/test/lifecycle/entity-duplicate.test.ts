import { randomUUID } from "node:crypto";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { describe, expect, it } from "vitest";

import { duplicateEntity } from "@/lib/data/entity-duplicate";
import { createPublishedDocument } from "@/lib/data/entity-lifecycle";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Transaction;

async function getEntityTypeId(tx: Tx, type: schema.EntityType["type"]): Promise<string> {
	const row = await tx.query.entityTypes.findFirst({
		where: { type },
		columns: { id: true },
	});
	assert(row, `${type} entity type not found in database`);
	return row.id;
}

async function getUnitTypeId(tx: Tx): Promise<string> {
	const row = await tx.query.organisationalUnitTypes.findFirst({ columns: { id: true } });
	assert(row, "no organisational_unit_types seeded in database");
	return row.id;
}

async function getUnitStatusId(tx: Tx): Promise<string> {
	const row = await tx.query.organisationalUnitStatus.findFirst({ columns: { id: true } });
	assert(row, "no organisational_unit_status seeded in database");
	return row.id;
}

async function getPersonRoleTypeId(tx: Tx): Promise<string> {
	const row = await tx.query.personRoleTypes.findFirst({ columns: { id: true } });
	assert(row, "no person_role_types seeded in database");
	return row.id;
}

/** Insert a bare entity document to act as an FK target (e.g. a relation's other endpoint). */
async function createBareEntity(tx: Tx, typeId: string): Promise<string> {
	const [row] = await tx
		.insert(schema.entities)
		.values({ typeId })
		.returning({ id: schema.entities.id });
	assert(row);
	return row.id;
}

/**
 * A published organisational unit with a subtype row — the shape the WG-reactivation case starts
 * from.
 */
async function createPublishedUnit(
	tx: Tx,
	name: string,
): Promise<{ documentId: string; versionId: string; slug: string }> {
	const typeId = await getEntityTypeId(tx, "organisational_units");
	const unitTypeId = await getUnitTypeId(tx);
	const slug = `duplicate-src-${randomUUID()}`;

	const { documentId, versionId } = await createPublishedDocument(tx, typeId, slug);
	await tx.insert(schema.organisationalUnits).values({ id: versionId, name, typeId: unitTypeId });

	return { documentId, versionId, slug };
}

/** Attach a rich-text content block to a version, so the clone has content to carry over. */
async function addRichTextContentBlock(
	tx: Tx,
	versionId: string,
	text: string,
): Promise<{ content: unknown }> {
	const fieldName = await tx.query.entityTypesFieldsNames.findFirst({ columns: { id: true } });
	assert(fieldName, "no entity_types_fields_names seeded in database");
	const blockType = await tx.query.contentBlockTypes.findFirst({
		where: { type: "rich_text" },
		columns: { id: true },
	});
	assert(blockType, "rich_text content block type not found in database");

	const [field] = await tx
		.insert(schema.fields)
		.values({ entityVersionId: versionId, fieldNameId: fieldName.id })
		.returning({ id: schema.fields.id });
	assert(field);

	const [block] = await tx
		.insert(schema.contentBlocks)
		.values({ fieldId: field.id, typeId: blockType.id, position: 0 })
		.returning({ id: schema.contentBlocks.id });
	assert(block);

	const content = {
		type: "doc",
		content: [{ type: "paragraph", content: [{ type: "text", text }] }],
	};
	await tx.insert(schema.richTextContentBlocks).values({ id: block.id, content });

	return { content };
}

/** Read back the rich-text content blocks attached to a version. */
async function getRichTextContent(tx: Tx, versionId: string): Promise<Array<unknown>> {
	const rows = await tx
		.select({ content: schema.richTextContentBlocks.content })
		.from(schema.richTextContentBlocks)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.id, schema.richTextContentBlocks.id))
		.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
		.where(eq(schema.fields.entityVersionId, versionId));

	return rows.map((row) => row.content);
}

async function getEntitySlug(tx: Tx, documentId: string): Promise<string | null> {
	const row = await tx
		.select({ slug: schema.slugs.value })
		.from(schema.slugs)
		.where(eq(schema.slugs.entityId, documentId))
		.then((rows) => rows[0]);

	return row?.slug ?? null;
}

async function getDraftVersionId(tx: Tx, documentId: string): Promise<string> {
	const row = await tx
		.select({ draftId: schema.documentLifecycle.draftId })
		.from(schema.documentLifecycle)
		.where(eq(schema.documentLifecycle.documentId, documentId))
		.then((rows) => rows[0]);

	assert(row?.draftId, `document "${documentId}" has no draft version`);
	return row.draftId;
}

describe("duplicateEntity", () => {
	it("clones the subtype, social media, and relations onto a new draft, leaving the source intact", async () => {
		await withTransaction(async (tx) => {
			const unitTypeId = await getUnitTypeId(tx);
			const statusId = await getUnitStatusId(tx);
			const entityTypeId = await getEntityTypeId(tx, "organisational_units");

			const source = await createPublishedUnit(tx, "Working Group Alpha");
			const eric = await createBareEntity(tx, entityTypeId);
			const relatedEntity = await createBareEntity(tx, entityTypeId);

			const socialMediaType = await tx.query.socialMediaTypes.findFirst({ columns: { id: true } });
			assert(socialMediaType, "no social_media_types seeded in database");
			const [account] = await tx
				.insert(schema.socialMedia)
				.values({ name: "Alpha", url: "https://example.com/alpha", typeId: socialMediaType.id })
				.returning({ id: schema.socialMedia.id });
			assert(account);
			await tx.insert(schema.organisationalUnitsToSocialMedia).values({
				organisationalUnitId: source.versionId,
				socialMediaId: account.id,
				position: 0,
			});

			// The group wound up in 2019 — the duration the clone must inherit verbatim.
			const duration = {
				start: new Date("2015-01-01T00:00:00.000Z"),
				end: new Date("2019-12-31T00:00:00.000Z"),
			};
			await tx.insert(schema.organisationalUnitsRelations).values({
				unitDocumentId: source.documentId,
				relatedUnitDocumentId: eric,
				status: statusId,
				duration,
			});
			await tx.insert(schema.entitiesToEntities).values({
				entityId: source.documentId,
				relatedEntityId: relatedEntity,
				position: 3,
			});

			const { content } = await addRichTextContentBlock(tx, source.versionId, "Alpha charter");

			const result = await duplicateEntity(tx, source.documentId);

			expect(result.cloneId).not.toBe(source.documentId);
			expect(result.slug).toBe(`${source.slug}-copy`);

			// The clone is draft-only: no published version, so it is absent from the website.
			const versions = await tx
				.select({ statusId: schema.entityVersions.statusId })
				.from(schema.entityVersions)
				.where(eq(schema.entityVersions.entityId, result.cloneId));
			expect(versions).toHaveLength(1);
			const cloneVersionId = await getDraftVersionId(tx, result.cloneId);

			// Subtype row cloned, carrying the source's title verbatim.
			const cloneUnit = await tx
				.select({
					name: schema.organisationalUnits.name,
					typeId: schema.organisationalUnits.typeId,
				})
				.from(schema.organisationalUnits)
				.where(eq(schema.organisationalUnits.id, cloneVersionId))
				.then((rows) => rows[0]);
			expect(cloneUnit).toStrictEqual({ name: "Working Group Alpha", typeId: unitTypeId });

			// Content blocks are cloned onto the new draft, not shared with the source's version.
			expect(await getRichTextContent(tx, cloneVersionId)).toStrictEqual([content]);
			expect(await getRichTextContent(tx, source.versionId)).toStrictEqual([content]);

			// Social media rides along on the subtype clone.
			const cloneSocialMedia = await tx
				.select({ socialMediaId: schema.organisationalUnitsToSocialMedia.socialMediaId })
				.from(schema.organisationalUnitsToSocialMedia)
				.where(eq(schema.organisationalUnitsToSocialMedia.organisationalUnitId, cloneVersionId));
			expect(cloneSocialMedia).toStrictEqual([{ socialMediaId: account.id }]);

			// Unit relation copied with its duration untouched — the clone looks as inactive as the source.
			const cloneRelations = await tx
				.select({
					relatedUnitDocumentId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
					duration: schema.organisationalUnitsRelations.duration,
				})
				.from(schema.organisationalUnitsRelations)
				.where(eq(schema.organisationalUnitsRelations.unitDocumentId, result.cloneId));
			expect(cloneRelations).toHaveLength(1);
			expect(cloneRelations[0]?.relatedUnitDocumentId).toBe(eric);
			expect(cloneRelations[0]?.duration).toStrictEqual(duration);

			// Related entities copied, position preserved.
			const cloneRelated = await tx
				.select({
					relatedEntityId: schema.entitiesToEntities.relatedEntityId,
					position: schema.entitiesToEntities.position,
				})
				.from(schema.entitiesToEntities)
				.where(eq(schema.entitiesToEntities.entityId, result.cloneId));
			expect(cloneRelated).toStrictEqual([{ relatedEntityId: relatedEntity, position: 3 }]);

			// The source keeps everything it had — duplicating moves nothing.
			const sourceRelations = await tx
				.select({ id: schema.organisationalUnitsRelations.id })
				.from(schema.organisationalUnitsRelations)
				.where(eq(schema.organisationalUnitsRelations.unitDocumentId, source.documentId));
			expect(sourceRelations).toHaveLength(1);
			expect(await tx.query.entities.findFirst({ where: { id: source.documentId } })).toBeDefined();
		});
	});

	it("copies relations pointing at the source, and skips degenerate self-relations", async () => {
		await withTransaction(async (tx) => {
			const entityTypeId = await getEntityTypeId(tx, "organisational_units");
			const source = await createPublishedUnit(tx, "Working Group Beta");
			const other = await createBareEntity(tx, entityTypeId);

			await tx.insert(schema.entitiesToEntities).values([
				// Points at the source → the clone must be pointed at too.
				{ entityId: other, relatedEntityId: source.documentId, position: 0 },
				// Degenerate self-relation: neither (clone, source) nor (source, clone) is a sensible copy.
				{ entityId: source.documentId, relatedEntityId: source.documentId, position: 0 },
			]);

			const result = await duplicateEntity(tx, source.documentId);

			const incoming = await tx
				.select({ entityId: schema.entitiesToEntities.entityId })
				.from(schema.entitiesToEntities)
				.where(eq(schema.entitiesToEntities.relatedEntityId, result.cloneId));
			expect(incoming).toStrictEqual([{ entityId: other }]);

			const outgoing = await tx
				.select({ relatedEntityId: schema.entitiesToEntities.relatedEntityId })
				.from(schema.entitiesToEntities)
				.where(eq(schema.entitiesToEntities.entityId, result.cloneId));
			expect(outgoing).toStrictEqual([]);
		});
	});

	it("never copies reporting data: the clone appears in no report", async () => {
		await withTransaction(async (tx) => {
			const personTypeId = await getEntityTypeId(tx, "persons");
			const roleTypeId = await getPersonRoleTypeId(tx);

			const source = await createPublishedUnit(tx, "Working Group Gamma");
			const country = await createBareEntity(tx, personTypeId);
			const person = await createBareEntity(tx, personTypeId);

			const [campaign] = await tx
				.insert(schema.reportingCampaigns)
				// `year` is unique; tests run concurrently, so keep well clear of real campaign years.
				.values({ year: 10_000 + Math.floor(Math.random() * 100_000) })
				.returning({ id: schema.reportingCampaigns.id });
			assert(campaign);

			const [report] = await tx
				.insert(schema.countryReports)
				.values({ campaignId: campaign.id, countryDocumentId: country })
				.returning({ id: schema.countryReports.id });
			assert(report);

			// The source is listed in the report's institutions snapshot …
			await tx.insert(schema.countryReportInstitutions).values({
				countryReportId: report.id,
				organisationalUnitDocumentId: source.documentId,
			});

			// … and carries a person relation that a report contribution hangs off.
			const [relation] = await tx
				.insert(schema.personsToOrganisationalUnits)
				.values({
					personDocumentId: person,
					organisationalUnitDocumentId: source.documentId,
					roleTypeId,
					duration: { start: new Date("2015-01-01T00:00:00.000Z") },
				})
				.returning({ id: schema.personsToOrganisationalUnits.id });
			assert(relation);
			await tx
				.insert(schema.countryReportContributions)
				.values({ countryReportId: report.id, personToOrgUnitId: relation.id });

			const result = await duplicateEntity(tx, source.documentId);

			// The institutions snapshot still names the source alone.
			const institutions = await tx
				.select({ unit: schema.countryReportInstitutions.organisationalUnitDocumentId })
				.from(schema.countryReportInstitutions)
				.where(eq(schema.countryReportInstitutions.countryReportId, report.id));
			expect(institutions).toStrictEqual([{ unit: source.documentId }]);

			// The person relation is copied onto the clone …
			const cloneRelations = await tx
				.select({ id: schema.personsToOrganisationalUnits.id })
				.from(schema.personsToOrganisationalUnits)
				.where(
					eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, result.cloneId),
				);
			expect(cloneRelations).toHaveLength(1);

			// … but its reporting child is not: the contribution stays attached to the source's relation.
			const contributions = await tx
				.select({ personToOrgUnitId: schema.countryReportContributions.personToOrgUnitId })
				.from(schema.countryReportContributions)
				.where(eq(schema.countryReportContributions.countryReportId, report.id));
			expect(contributions).toStrictEqual([{ personToOrgUnitId: relation.id }]);
		});
	});

	it("derives a free slug when a copy already exists", async () => {
		await withTransaction(async (tx) => {
			const source = await createPublishedUnit(tx, "Working Group Delta");

			const first = await duplicateEntity(tx, source.documentId);
			expect(first.slug).toBe(`${source.slug}-copy`);

			const second = await duplicateEntity(tx, source.documentId);
			expect(second.slug).toBe(`${source.slug}-copy-2`);
		});
	});

	it("uses the caller's slug, normalised, when one is given", async () => {
		await withTransaction(async (tx) => {
			const source = await createPublishedUnit(tx, "Working Group Epsilon");

			const result = await duplicateEntity(tx, source.documentId, "Institution B!");

			expect(result.slug).toBe("institution-b");
			expect(await getEntitySlug(tx, result.cloneId)).toBe("institution-b");
		});
	});

	it("surfaces a colliding explicit slug as an error instead of renaming it", async () => {
		await withTransaction(async (tx) => {
			const source = await createPublishedUnit(tx, "Working Group Zeta");
			const taken = await createPublishedUnit(tx, "Working Group Eta");

			// The admin asked for this exact slug: silently storing `<slug>-2` would be worse than failing.
			await expect(duplicateEntity(tx, source.documentId, taken.slug)).rejects.toThrow();
		});
	});
});
