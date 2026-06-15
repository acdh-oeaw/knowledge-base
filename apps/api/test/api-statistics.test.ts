import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import { getStatistics } from "@/routes/statistics/service";
import { withTransaction } from "~/test/lib/with-transaction";

function createOrganisationalUnit(statusId: string, entityTypeId: string) {
	const entityId = uuidv7();
	const versionId = uuidv7();
	const name = f.company.name();

	return {
		entity: {
			id: entityId,
			slug: `${slugify(name)}-${f.string.alphanumeric(8).toLowerCase()}`,
			typeId: entityTypeId,
		},
		version: {
			id: versionId,
			entityId,
			statusId,
		},
		unit: {
			id: versionId,
			name,
		},
	};
}

async function seedMemberCountryCountFixtures(db: Database) {
	const [publishedStatus, draftStatus, entityType, countryType, ericType, memberStatus] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "draft" } }),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "organisational_units" },
			}),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "country" },
			}),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "eric" },
			}),
			db.query.organisationalUnitStatus.findFirst({
				columns: { id: true },
				where: { status: "is_member_of" },
			}),
		]);

	assert(publishedStatus, "No published entity status in database.");
	assert(draftStatus, "No draft entity status in database.");
	assert(entityType, "No organisational_units entity type in database.");
	assert(countryType, "No country type in database.");
	assert(ericType, "No eric type in database.");
	assert(memberStatus, "No is_member_of status in database.");

	const eric = await db.query.organisationalUnits.findFirst({
		columns: { id: true },
		where: {
			type: {
				type: "eric",
			},
		},
	});

	assert(eric, "No eric organisational unit in database.");

	// unit↔unit relations are document-level; resolve the eric version id to its document id.
	const ericDocument = await db.query.entityVersions.findFirst({
		columns: { entityId: true },
		where: { id: eric.id },
	});
	assert(ericDocument, "No eric entity version in database.");

	const publishedCountry = createOrganisationalUnit(publishedStatus.id, entityType.id);
	const draftCountry = createOrganisationalUnit(draftStatus.id, entityType.id);
	const start = f.date.past({ years: 5 });

	await db.insert(schema.entities).values([publishedCountry.entity, draftCountry.entity]);
	await db.insert(schema.entityVersions).values([publishedCountry.version, draftCountry.version]);
	await db.insert(schema.organisationalUnits).values([
		{ ...publishedCountry.unit, typeId: countryType.id },
		{ ...draftCountry.unit, typeId: countryType.id },
	]);

	// The (unit, related, status) uniqueness is now enforced by a constraint, so a published country
	// can only carry one active is_member_of relation; the draft country must not be counted.
	await db.insert(schema.organisationalUnitsRelations).values([
		{
			unitDocumentId: publishedCountry.entity.id,
			relatedUnitDocumentId: ericDocument.entityId,
			status: memberStatus.id,
			duration: { start },
		},
		{
			unitDocumentId: draftCountry.entity.id,
			relatedUnitDocumentId: ericDocument.entityId,
			status: memberStatus.id,
			duration: { start },
		},
	]);
}

async function seedWorkingGroupCountFixtures(db: Database) {
	const [publishedStatus, draftStatus, entityType, workingGroupType, memberStatus] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "draft" } }),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "organisational_units" },
			}),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "working_group" },
			}),
			db.query.organisationalUnitStatus.findFirst({
				columns: { id: true },
				where: { status: "is_part_of" },
			}),
		]);

	assert(publishedStatus, "No published entity status in database.");
	assert(draftStatus, "No draft entity status in database.");
	assert(entityType, "No organisational_units entity type in database.");
	assert(workingGroupType, "No working_group type in database.");
	assert(memberStatus, "No is_part_of status in database.");

	const eric = await db.query.organisationalUnits.findFirst({
		columns: { id: true },
		where: {
			type: {
				type: "eric",
			},
		},
	});

	assert(eric, "No eric organisational unit in database.");

	// unit↔unit relations are document-level; resolve the eric version id to its document id.
	const ericDocument = await db.query.entityVersions.findFirst({
		columns: { entityId: true },
		where: { id: eric.id },
	});
	assert(ericDocument, "No eric entity version in database.");

	const publishedWorkingGroup = createOrganisationalUnit(publishedStatus.id, entityType.id);
	const draftWorkingGroup = createOrganisationalUnit(draftStatus.id, entityType.id);
	const start = f.date.past({ years: 5 });

	await db.insert(schema.entities).values([publishedWorkingGroup.entity, draftWorkingGroup.entity]);
	await db
		.insert(schema.entityVersions)
		.values([publishedWorkingGroup.version, draftWorkingGroup.version]);
	await db.insert(schema.organisationalUnits).values([
		{ ...publishedWorkingGroup.unit, typeId: workingGroupType.id },
		{ ...draftWorkingGroup.unit, typeId: workingGroupType.id },
	]);

	// The (unit, related, status) uniqueness is now enforced by a constraint, so a published working
	// group can only carry one active is_part_of relation; the draft working group must not count.
	await db.insert(schema.organisationalUnitsRelations).values([
		{
			unitDocumentId: publishedWorkingGroup.entity.id,
			relatedUnitDocumentId: ericDocument.entityId,
			status: memberStatus.id,
			duration: { start },
		},
		{
			unitDocumentId: draftWorkingGroup.entity.id,
			relatedUnitDocumentId: ericDocument.entityId,
			status: memberStatus.id,
			duration: { start },
		},
	]);
}

async function seedPartnerInstitutionWithOverlappingRelations(db: Database) {
	const [publishedStatus, entityType, institutionType, partnerStatus, coordinatingStatus] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "organisational_units" },
			}),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "institution" },
			}),
			db.query.organisationalUnitStatus.findFirst({
				columns: { id: true },
				where: { status: "is_partner_institution_of" },
			}),
			db.query.organisationalUnitStatus.findFirst({
				columns: { id: true },
				where: { status: "is_national_coordinating_institution_in" },
			}),
		]);

	assert(publishedStatus, "No published entity status in database.");
	assert(entityType, "No organisational_units entity type in database.");
	assert(institutionType, "No institution type in database.");
	assert(partnerStatus, "No is_partner_institution_of status in database.");
	assert(coordinatingStatus, "No is_national_coordinating_institution_in status in database.");

	const eric = await db.query.organisationalUnits.findFirst({
		columns: { id: true },
		where: { type: { type: "eric" } },
	});
	assert(eric, "No eric organisational unit in database.");

	const ericDocument = await db.query.entityVersions.findFirst({
		columns: { entityId: true },
		where: { id: eric.id },
	});
	assert(ericDocument, "No eric entity version in database.");

	const institution = createOrganisationalUnit(publishedStatus.id, entityType.id);
	await db.insert(schema.entities).values(institution.entity);
	await db.insert(schema.entityVersions).values(institution.version);
	await db
		.insert(schema.organisationalUnits)
		.values({ ...institution.unit, typeId: institutionType.id });
	await db.insert(schema.organisationalUnitsRelations).values([
		{
			unitDocumentId: institution.entity.id,
			relatedUnitDocumentId: ericDocument.entityId,
			status: partnerStatus.id,
			duration: { start: f.date.past({ years: 5 }) },
		},
		{
			unitDocumentId: institution.entity.id,
			relatedUnitDocumentId: ericDocument.entityId,
			status: coordinatingStatus.id,
			duration: { start: f.date.past({ years: 5 }) },
		},
	]);
}

describe("statistics", () => {
	it("counts distinct published member countries", async () => {
		await withTransaction(async (db) => {
			const before = await getStatistics(db);
			assert(before.memberCountries != null, "Expected memberCountries statistic.");

			await seedMemberCountryCountFixtures(db);

			const after = await getStatistics(db);
			assert(after.memberCountries != null, "Expected memberCountries statistic.");

			expect(after.memberCountries).toBe(before.memberCountries + 1);
		});
	});

	it("counts distinct published active working groups", async () => {
		await withTransaction(async (db) => {
			const before = await getStatistics(db);
			assert(before.workingGroups != null, "Expected workingGroups statistic.");

			await seedWorkingGroupCountFixtures(db);

			const after = await getStatistics(db);
			assert(after.workingGroups != null, "Expected workingGroups statistic.");

			expect(after.workingGroups).toBe(before.workingGroups + 1);
		});
	});

	it("counts an institution with partner and coordinating relations once", async () => {
		await withTransaction(async (db) => {
			const before = await getStatistics(db);
			assert(before.partnerInstitutions != null, "Expected partnerInstitutions statistic.");

			await seedPartnerInstitutionWithOverlappingRelations(db);

			const after = await getStatistics(db);
			assert(after.partnerInstitutions != null, "Expected partnerInstitutions statistic.");

			expect(after.partnerInstitutions).toBe(before.partnerInstitutions + 1);
		});
	});
});
