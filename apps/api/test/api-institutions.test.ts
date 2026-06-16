import * as schema from "@acdh-knowledge-base/database/schema";
import { assert } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";

import type { Database } from "@/middlewares/db";
import type { Institution, InstitutionStatus } from "@/routes/institutions/schemas";
import { createTestClient } from "~/test/lib/create-test-client";
import { withTransaction } from "~/test/lib/with-transaction";

const dariahEuSlug = "dariah-eu";

async function getDariahEu(db: Database) {
	const unit = await db.query.organisationalUnits.findFirst({
		columns: { id: true },
		where: { entityVersion: { entity: { slug: dariahEuSlug } }, type: { type: "eric" } },
		with: { entityVersion: { columns: { entityId: true } } },
	});

	assert(unit, "No DARIAH-EU organisational unit in database.");

	return { documentId: unit.entityVersion.entityId, versionId: unit.id };
}

function createItem() {
	const versionId = uuidv7();
	const entityId = uuidv7();
	const name = f.company.name();
	const slug = slugify(`${name}-${entityId}`);

	return {
		entity: { id: entityId, slug },
		version: { id: versionId, entityId },
		organisationalUnit: {
			id: versionId,
			name,
			acronym: f.string.alpha({ length: 4, casing: "upper" }),
			summary: f.lorem.paragraph(),
		},
	};
}

type Item = ReturnType<typeof createItem>;

async function lookup(db: Database) {
	const [publishedStatus, organisationalUnitEntityType, types, statuses] = await Promise.all([
		db.query.entityStatus.findFirst({ columns: { id: true }, where: { type: "published" } }),
		db.query.entityTypes.findFirst({
			columns: { id: true },
			where: { type: "organisational_units" },
		}),
		db.query.organisationalUnitTypes.findMany({ columns: { id: true, type: true } }),
		db.query.organisationalUnitStatus.findMany({ columns: { id: true, status: true } }),
	]);

	assert(publishedStatus, "No published entity status in database.");
	assert(organisationalUnitEntityType, "No organisational unit entity type in database.");

	const typeId = (type: (typeof schema.organisationalUnitTypesEnum)[number]) => {
		const match = types.find((t) => t.type === type);
		assert(match, `No ${type} organisational unit type in database.`);
		return match.id;
	};
	const statusId = (status: (typeof schema.organisationalUnitStatusEnum)[number]) => {
		const match = statuses.find((s) => s.status === status);
		assert(match, `No ${status} organisational unit status in database.`);
		return match.id;
	};

	return { publishedStatus, organisationalUnitEntityType, typeId, statusId };
}

async function seedUnit(
	db: Database,
	item: Item,
	typeId: string,
	meta: Awaited<ReturnType<typeof lookup>>,
) {
	await db
		.insert(schema.entities)
		.values({ ...item.entity, typeId: meta.organisationalUnitEntityType.id });
	await db
		.insert(schema.entityVersions)
		.values({ ...item.version, statusId: meta.publishedStatus.id });
	await db.insert(schema.organisationalUnits).values({ ...item.organisationalUnit, typeId });
}

async function relate(
	db: Database,
	unit: Item,
	relatedUnitDocumentId: string,
	statusId: string,
	start = f.date.past({ years: 5 }),
) {
	await db.insert(schema.organisationalUnitsRelations).values({
		unitDocumentId: unit.entity.id,
		relatedUnitDocumentId,
		status: statusId,
		duration: { start },
	});
}

async function seedEric(db: Database) {
	const meta = await lookup(db);
	const eric = createItem();
	await seedUnit(db, eric, meta.typeId("eric"), meta);
	return eric;
}

interface SeedInstitutionOptions {
	relation?: "is_partner_institution_of" | "is_cooperating_partner_of";
	/** The related ERIC document id; defaults to DARIAH-EU. */
	ericDocumentId?: string;
}

/**
 * Seeds a published institution located in a (new) country, optionally related to an ERIC unit
 * (DARIAH-EU by default) with the given relation status.
 */
async function seedInstitution(db: Database, options: SeedInstitutionOptions = {}) {
	const meta = await lookup(db);

	const institution = createItem();
	const country = createItem();

	await seedUnit(db, institution, meta.typeId("institution"), meta);
	await seedUnit(db, country, meta.typeId("country"), meta);

	await relate(db, institution, country.entity.id, meta.statusId("is_located_in"));

	if (options.relation != null) {
		const ericDocumentId = options.ericDocumentId ?? (await getDariahEu(db)).documentId;
		await relate(db, institution, ericDocumentId, meta.statusId(options.relation));
	}

	return { institution, country };
}

async function listInstitutions(db: Database, status?: Array<InstitutionStatus>) {
	const client = createTestClient(db);
	const response = await client.institutions.$get({
		query: { limit: "100", offset: "0", ...(status != null ? { status } : {}) },
	});

	expect(response.status).toBe(200);

	return (await response.json()) as { data: Array<Institution>; total: number };
}

describe("institutions", () => {
	describe("GET /api/institutions", () => {
		it("should return partner institutions with their country and relation status", async () => {
			await withTransaction(async (db) => {
				const { institution, country } = await seedInstitution(db, {
					relation: "is_partner_institution_of",
				});

				const data = await listInstitutions(db);

				const entry = data.data.find((item) => item.id === institution.organisationalUnit.id);
				assert(entry, "Seeded institution not returned.");

				expect(entry).toMatchObject({
					name: institution.organisationalUnit.name,
					slug: institution.entity.slug,
					status: "partner_institution" satisfies InstitutionStatus,
					country: {
						name: country.organisationalUnit.name,
						slug: country.entity.slug,
					},
				});
			});
		});

		it("should return institutions with no dariah-eu relation as status none", async () => {
			await withTransaction(async (db) => {
				const { institution, country } = await seedInstitution(db);

				const data = await listInstitutions(db);

				const entry = data.data.find((item) => item.id === institution.organisationalUnit.id);
				assert(entry, "Seeded institution not returned.");

				expect(entry).toMatchObject({
					status: "none" satisfies InstitutionStatus,
					country: { name: country.organisationalUnit.name },
				});
			});
		});

		it("should treat relations to other eric units than dariah-eu as none", async () => {
			await withTransaction(async (db) => {
				const otherEric = await seedEric(db);
				const { institution } = await seedInstitution(db, {
					relation: "is_partner_institution_of",
					ericDocumentId: otherEric.entity.id,
				});

				const data = await listInstitutions(db);

				const entry = data.data.find((item) => item.id === institution.organisationalUnit.id);
				assert(entry, "Seeded institution not returned.");

				expect(entry.status).toBe("none" satisfies InstitutionStatus);
			});
		});

		it("should filter by a single relation status", async () => {
			await withTransaction(async (db) => {
				const partner = await seedInstitution(db, { relation: "is_partner_institution_of" });
				const cooperating = await seedInstitution(db, { relation: "is_cooperating_partner_of" });

				const data = await listInstitutions(db, ["cooperating_partner"]);
				const ids = data.data.map((item) => item.id);

				expect(ids).toContain(cooperating.institution.organisationalUnit.id);
				expect(ids).not.toContain(partner.institution.organisationalUnit.id);
				expect(data.data.every((item) => item.status === "cooperating_partner")).toBe(true);
			});
		});

		it("should filter by multiple statuses as a union", async () => {
			await withTransaction(async (db) => {
				const partner = await seedInstitution(db, { relation: "is_partner_institution_of" });
				const cooperating = await seedInstitution(db, { relation: "is_cooperating_partner_of" });
				const unrelated = await seedInstitution(db);

				const data = await listInstitutions(db, ["partner_institution", "none"]);
				const ids = data.data.map((item) => item.id);

				expect(ids).toContain(partner.institution.organisationalUnit.id);
				expect(ids).toContain(unrelated.institution.organisationalUnit.id);
				expect(ids).not.toContain(cooperating.institution.organisationalUnit.id);
				expect(data.data.every((item) => item.status !== "cooperating_partner")).toBe(true);
			});
		});
	});

	describe("GET /api/institutions/:id", () => {
		it("should return a single institution by id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { institution, country } = await seedInstitution(db, {
					relation: "is_cooperating_partner_of",
				});

				const response = await client.institutions[":id"].$get({
					param: { id: institution.version.id },
				});

				expect(response.status).toBe(200);

				const data = (await response.json()) as Institution;

				expect(data).toMatchObject({
					name: institution.organisationalUnit.name,
					status: "cooperating_partner" satisfies InstitutionStatus,
					country: { name: country.organisationalUnit.name },
				});
			});
		});

		it("should return 400 for invalid id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.institutions[":id"].$get({ param: { id: "no-uuid" } });

				expect(response.status).toBe(400);
			});
		});

		it("should return 404 for non-existing id", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.institutions[":id"].$get({
					param: { id: "019b75fd-6d6a-757c-acc2-c3c6266a0f31" },
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/institutions/slugs/:slug", () => {
		it("should return a single institution by slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { institution } = await seedInstitution(db, {
					relation: "is_partner_institution_of",
				});

				const response = await client.institutions.slugs[":slug"].$get({
					param: { slug: institution.entity.slug },
				});

				expect(response.status).toBe(200);

				const data = (await response.json()) as Institution;

				expect(data).toMatchObject({
					name: institution.organisationalUnit.name,
					slug: institution.entity.slug,
				});
			});
		});

		it("should return 404 for non-existing slug", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const response = await client.institutions.slugs[":slug"].$get({
					param: { slug: "non-existing-slug" },
				});

				expect(response.status).toBe(404);
			});
		});
	});

	describe("GET /api/institutions/slugs", () => {
		it("should return a paginated list of slugs including unrelated institutions", async () => {
			await withTransaction(async (db) => {
				const client = createTestClient(db);

				const { institution } = await seedInstitution(db);

				const response = await client.institutions.slugs.$get({
					query: { limit: "100", offset: "0" },
				});

				expect(response.status).toBe(200);

				const data = (await response.json()) as {
					data: Array<{ id: string; slug: string }>;
				};

				expect(data.data).toEqual(
					expect.arrayContaining([expect.objectContaining({ slug: institution.entity.slug })]),
				);
			});
		});
	});
});
