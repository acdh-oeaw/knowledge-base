import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { GovernanceBody, GovernanceBodyBase } from "@/routes/governance-bodies/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

const workingGroupsGovernanceBodyId = "019b7a56-b301-7f93-9d24-91333bdc3ca8";

function createWorkingGroup() {
	const versionId = uuidv7();
	const entityId = uuidv7();
	const name = f.lorem.sentence();

	return {
		entity: { id: entityId, slug: slugify(name) },
		version: { id: versionId, entityId },
		organisationalUnit: {
			id: versionId,
			name,
			summary: f.lorem.paragraph(),
		},
	};
}

function createChair() {
	const versionId = uuidv7();
	const entityId = uuidv7();
	const assetId = uuidv7();
	const name = f.person.fullName();

	return {
		entity: { id: entityId, slug: slugify(name) },
		version: { id: versionId, entityId },
		asset: {
			id: assetId,
			key: `persons/${assetId}.jpg`,
			label: name,
			mimeType: "image/jpeg",
		},
		person: {
			id: versionId,
			name,
			sortName: f.person.lastName(),
			email: f.internet.email(),
			orcid: `0000-000${String(f.number.int({ min: 1, max: 9 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}-${String(f.number.int({ min: 1000, max: 9999 }))}`,
			imageId: assetId,
		},
	};
}

async function seedWorkingGroupChair(
	db: Database,
	workingGroup = createWorkingGroup(),
	chair = createChair(),
) {
	const [status, organisationalUnitEntityType, personEntityType, workingGroupType, chairRoleType] =
		await Promise.all([
			db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "organisational_units" },
			}),
			db.query.entityTypes.findFirst({
				columns: { id: true },
				where: { type: "persons" },
			}),
			db.query.organisationalUnitTypes.findFirst({
				columns: { id: true },
				where: { type: "working_group" },
			}),
			db.query.personRoleTypes.findFirst({
				columns: { id: true },
				where: { type: "is_chair_of" },
			}),
		]);

	assert(status, "No entity status in database.");
	assert(organisationalUnitEntityType, "No organisational unit entity type in database.");
	assert(personEntityType, "No person entity type in database.");
	assert(workingGroupType, "No working_group type in database.");
	assert(chairRoleType, "No chair role type in database.");

	await db.insert(schema.entities).values([
		{ ...workingGroup.entity, typeId: organisationalUnitEntityType.id },
		{ ...chair.entity, typeId: personEntityType.id },
	]);

	await db.insert(schema.entityVersions).values([
		{ ...workingGroup.version, statusId: status.id },
		{ ...chair.version, statusId: status.id },
	]);

	await db.insert(schema.organisationalUnits).values({
		...workingGroup.organisationalUnit,
		typeId: workingGroupType.id,
	});

	await db.insert(schema.assets).values(chair.asset);
	await db.insert(schema.persons).values(chair.person);

	await db.insert(schema.personsToOrganisationalUnits).values({
		personDocumentId: chair.entity.id,
		organisationalUnitDocumentId: workingGroup.entity.id,
		roleTypeId: chairRoleType.id,
		duration: { start: f.date.past({ years: 5 }) },
	});

	return { chair, workingGroup };
}

describe("governance-bodies", () => {
	describe("GET /api/governance-bodies", () => {
		it("should include working groups with all working group chairs", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const { chair } = await seedWorkingGroupChair(db);

				const firstPageResponse = await client["governance-bodies"].$get({
					query: { limit: "1", offset: "0" },
				});

				expect(firstPageResponse.status).toBe(200);
				const firstPage = (await firstPageResponse.json()) as { total: number };
				const workingGroupsOffset = firstPage.total - 1;

				const response = await client["governance-bodies"].$get({
					query: { limit: "1", offset: String(workingGroupsOffset) },
				});

				expect(response.status).toBe(200);
				const data = (await response.json()) as { data: Array<GovernanceBodyBase> };
				const workingGroups = data.data.at(0);

				expect(workingGroups).toMatchObject({
					id: workingGroupsGovernanceBodyId,
					name: "Working groups",
					entity: { slug: "working-groups" },
				});
				expect(workingGroups?.persons).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							id: chair.person.id,
							name: chair.person.name,
							role: "is_chair_of",
						}),
					]),
				);
			});
		});
	});

	describe("GET /api/governance-bodies/slugs/:slug", () => {
		it("should return working groups with all working group chairs", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);
				const { chair } = await seedWorkingGroupChair(db);

				const response = await client["governance-bodies"].slugs[":slug"].$get({
					param: { slug: "working-groups" },
				});

				expect(response.status).toBe(200);
				const data = (await response.json()) as GovernanceBody;

				expect(data).toMatchObject({
					id: workingGroupsGovernanceBodyId,
					name: "Working groups",
					entity: { slug: "working-groups" },
				});
				expect(data.persons).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							id: chair.person.id,
							name: chair.person.name,
							role: "is_chair_of",
						}),
					]),
				);
				expect(data.description).toHaveLength(1);
				expect(data.description[0]).toMatchObject({ type: "rich_text" });
			});
		});
	});
});
