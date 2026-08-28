import { randomUUID } from "node:crypto";

import { assert } from "@acdh-oeaw/lib";
import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { describe, expect, it, vi } from "vitest";

import type { Transaction } from "@/lib/db";
import { withTransaction } from "@/test/lib/with-transaction";

// The delegated edit guards redirect (next navigation) + read the locale on the deny path. Replace both
// with minimal stubs: a denied check throws a recognizable error, and the locale lookup resolves — both
// without loading the real Next-runtime modules (which don't import outside a request/Next context).
vi.mock("@/lib/navigation/navigation", () => {
	return {
		redirect: () => {
			throw new Error("REDIRECT");
		},
	};
});
vi.mock("next-intl/server", () => {
	return {
		getLocale: () => Promise.resolve("en"),
	};
});

const { can } = await import("@/lib/auth/permissions");
const { assertCanEditPerson } =
	await import("@/app/(app)/[locale]/(dashboard)/dashboard/_lib/authorize-delegated-person");
const { assertCanManageCountryInstitutionRelation, assertCanEditCountryInstitution } =
	await import("@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/authorize-country-institution-relation");
const { createDraftDocument } = await import("@/lib/data/entity-lifecycle");
const { getDariahEricDocumentId } = await import("@/lib/data/unit-relations");

type Tx = Transaction;

const ACTIVE_DURATION = { start: new Date("2020-01-01T00:00:00.000Z") } as const;

function makeUser(
	overrides: Readonly<{
		role?: "admin" | "user";
		personDocumentId?: string | null;
		organisationalUnitDocumentId?: string | null;
	}>,
): User {
	return {
		role: overrides.role ?? "user",
		personDocumentId: overrides.personDocumentId ?? null,
		organisationalUnitDocumentId: overrides.organisationalUnitDocumentId ?? null,
	} as unknown as User;
}

async function entityTypeId(tx: Tx, type: "organisational_units" | "persons"): Promise<string> {
	const row = await tx.query.entityTypes.findFirst({ where: { type }, columns: { id: true } });
	assert(row, `entity type "${type}" not seeded`);
	return row.id;
}

async function orgUnitTypeId(
	tx: Tx,
	type: "country" | "working_group" | "national_consortium" | "institution",
): Promise<string> {
	const row = await tx.query.organisationalUnitTypes.findFirst({
		where: { type },
		columns: { id: true },
	});
	assert(row, `organisational unit type "${type}" not seeded`);
	return row.id;
}

async function roleTypeId(
	tx: Tx,
	type: (typeof schema.personRoleTypesEnum)[number],
): Promise<string> {
	const row = await tx.query.personRoleTypes.findFirst({ where: { type }, columns: { id: true } });
	assert(row, `person role type "${type}" not seeded`);
	return row.id;
}

async function statusId(
	tx: Tx,
	status: (typeof schema.organisationalUnitStatusEnum)[number],
): Promise<string> {
	const row = await tx.query.organisationalUnitStatus.findFirst({
		where: { status },
		columns: { id: true },
	});
	assert(row, `organisational unit status "${status}" not seeded`);
	return row.id;
}

/** Seeds a (draft) organisational unit of the given type and returns its document id. */
async function seedUnit(
	tx: Tx,
	type: "country" | "working_group" | "national_consortium" | "institution",
): Promise<string> {
	const { documentId, versionId } = await createDraftDocument(
		tx,
		await entityTypeId(tx, "organisational_units"),
		`e2e-${type}-${randomUUID()}`,
	);
	await tx.insert(schema.organisationalUnits).values({
		id: versionId,
		name: `Test ${type} ${documentId.slice(0, 8)}`,
		typeId: await orgUnitTypeId(tx, type),
	});
	return documentId;
}

/** Seeds a (draft) person document and returns its document id. */
async function seedPersonDocument(tx: Tx): Promise<string> {
	const { documentId } = await createDraftDocument(
		tx,
		await entityTypeId(tx, "persons"),
		`e2e-person-${randomUUID()}`,
	);
	return documentId;
}

async function seedPersonRelation(
	tx: Tx,
	input: Readonly<{
		personDocumentId: string;
		organisationalUnitDocumentId: string;
		role: (typeof schema.personRoleTypesEnum)[number];
	}>,
): Promise<void> {
	await tx.insert(schema.personsToOrganisationalUnits).values({
		personDocumentId: input.personDocumentId,
		organisationalUnitDocumentId: input.organisationalUnitDocumentId,
		roleTypeId: await roleTypeId(tx, input.role),
		duration: ACTIVE_DURATION,
	});
}

async function seedUnitRelation(
	tx: Tx,
	input: Readonly<{
		unitDocumentId: string;
		relatedUnitDocumentId: string;
		status: (typeof schema.organisationalUnitStatusEnum)[number];
	}>,
): Promise<void> {
	await tx.insert(schema.organisationalUnitsRelations).values({
		unitDocumentId: input.unitDocumentId,
		relatedUnitDocumentId: input.relatedUnitDocumentId,
		status: await statusId(tx, input.status),
		duration: ACTIVE_DURATION,
	});
}

describe("can() — organisational_unit update/read gate", () => {
	it("working group: only chairs/vice-chairs may update; members read; others are denied", async () => {
		await withTransaction(async (tx) => {
			const wg = await seedUnit(tx, "working_group");
			const chair = await seedPersonDocument(tx);
			const viceChair = await seedPersonDocument(tx);
			const member = await seedPersonDocument(tx);
			const stranger = await seedPersonDocument(tx);

			await seedPersonRelation(tx, {
				personDocumentId: chair,
				organisationalUnitDocumentId: wg,
				role: "is_chair_of",
			});
			await seedPersonRelation(tx, {
				personDocumentId: viceChair,
				organisationalUnitDocumentId: wg,
				role: "is_vice_chair_of",
			});
			await seedPersonRelation(tx, {
				personDocumentId: member,
				organisationalUnitDocumentId: wg,
				role: "is_member_of",
			});

			const resource = { type: "organisational_unit", id: wg } as const;

			expect(await can(makeUser({ personDocumentId: chair }), "update", resource, tx)).toBe(true);
			expect(await can(makeUser({ personDocumentId: viceChair }), "update", resource, tx)).toBe(
				true,
			);
			expect(await can(makeUser({ personDocumentId: member }), "update", resource, tx)).toBe(false);
			expect(await can(makeUser({ personDocumentId: member }), "read", resource, tx)).toBe(true);
			expect(await can(makeUser({ personDocumentId: stranger }), "update", resource, tx)).toBe(
				false,
			);
			expect(await can(makeUser({ personDocumentId: stranger }), "read", resource, tx)).toBe(false);
			expect(await can(makeUser({ role: "admin" }), "update", resource, tx)).toBe(true);
		});
	});

	it("country: only coordinators/deputies may update; staff & representatives read", async () => {
		await withTransaction(async (tx) => {
			const country = await seedUnit(tx, "country");
			const coordinator = await seedPersonDocument(tx);
			const staff = await seedPersonDocument(tx);
			const representative = await seedPersonDocument(tx);
			const stranger = await seedPersonDocument(tx);

			await seedPersonRelation(tx, {
				personDocumentId: coordinator,
				organisationalUnitDocumentId: country,
				role: "national_coordinator",
			});
			await seedPersonRelation(tx, {
				personDocumentId: staff,
				organisationalUnitDocumentId: country,
				role: "national_coordination_staff",
			});
			await seedPersonRelation(tx, {
				personDocumentId: representative,
				organisationalUnitDocumentId: country,
				role: "national_representative",
			});

			const resource = { type: "organisational_unit", id: country } as const;

			expect(await can(makeUser({ personDocumentId: coordinator }), "update", resource, tx)).toBe(
				true,
			);
			expect(await can(makeUser({ personDocumentId: staff }), "update", resource, tx)).toBe(false);
			expect(await can(makeUser({ personDocumentId: staff }), "read", resource, tx)).toBe(true);
			expect(
				await can(makeUser({ personDocumentId: representative }), "update", resource, tx),
			).toBe(false);
			expect(await can(makeUser({ personDocumentId: representative }), "read", resource, tx)).toBe(
				true,
			);
			expect(await can(makeUser({ personDocumentId: stranger }), "read", resource, tx)).toBe(false);
		});
	});

	it("national consortium: resolves to its country — a coordinator of that country may update", async () => {
		await withTransaction(async (tx) => {
			const country = await seedUnit(tx, "country");
			const consortium = await seedUnit(tx, "national_consortium");
			await seedUnitRelation(tx, {
				unitDocumentId: consortium,
				relatedUnitDocumentId: country,
				status: "is_national_consortium_of",
			});

			const coordinator = await seedPersonDocument(tx);
			await seedPersonRelation(tx, {
				personDocumentId: coordinator,
				organisationalUnitDocumentId: country,
				role: "national_coordinator",
			});
			const stranger = await seedPersonDocument(tx);

			const resource = { type: "organisational_unit", id: consortium } as const;

			expect(await can(makeUser({ personDocumentId: coordinator }), "update", resource, tx)).toBe(
				true,
			);
			expect(await can(makeUser({ personDocumentId: stranger }), "update", resource, tx)).toBe(
				false,
			);
		});
	});
});

describe("delegated edit guards", () => {
	it("assertCanEditPerson: allows when the person is in a managed unit, denies otherwise", async () => {
		await withTransaction(async (tx) => {
			const wg = await seedUnit(tx, "working_group");
			const chair = await seedPersonDocument(tx);
			await seedPersonRelation(tx, {
				personDocumentId: chair,
				organisationalUnitDocumentId: wg,
				role: "is_chair_of",
			});

			// A person linked to the chair's working group → editable by the chair.
			const editablePerson = await seedPersonDocument(tx);
			await seedPersonRelation(tx, {
				personDocumentId: editablePerson,
				organisationalUnitDocumentId: wg,
				role: "is_member_of",
			});

			// A person linked only to an unrelated working group → not editable by the chair.
			const otherWg = await seedUnit(tx, "working_group");
			const foreignPerson = await seedPersonDocument(tx);
			await seedPersonRelation(tx, {
				personDocumentId: foreignPerson,
				organisationalUnitDocumentId: otherWg,
				role: "is_member_of",
			});

			const chairUser = makeUser({ personDocumentId: chair });

			await expect(assertCanEditPerson(chairUser, editablePerson, tx)).resolves.toBeUndefined();
			await expect(assertCanEditPerson(chairUser, foreignPerson, tx)).rejects.toThrow("REDIRECT");
			await expect(
				assertCanEditPerson(makeUser({ role: "admin" }), foreignPerson, tx),
			).resolves.toBeUndefined();
		});
	});

	it("assertCanManageCountryInstitutionRelation: requires ERIC target + own-country institution", async () => {
		await withTransaction(async (tx) => {
			const ericDocumentId = await getDariahEricDocumentId();
			assert(ericDocumentId, "DARIAH ERIC must be seeded for this test");

			const country = await seedUnit(tx, "country");
			const coordinator = await seedPersonDocument(tx);
			await seedPersonRelation(tx, {
				personDocumentId: coordinator,
				organisationalUnitDocumentId: country,
				role: "national_coordinator",
			});

			// Institution located in the coordinator's country.
			const institution = await seedUnit(tx, "institution");
			await seedUnitRelation(tx, {
				unitDocumentId: institution,
				relatedUnitDocumentId: country,
				status: "is_located_in",
			});

			// Institution located in a different (unmanaged) country.
			const otherCountry = await seedUnit(tx, "country");
			const foreignInstitution = await seedUnit(tx, "institution");
			await seedUnitRelation(tx, {
				unitDocumentId: foreignInstitution,
				relatedUnitDocumentId: otherCountry,
				status: "is_located_in",
			});

			const user = makeUser({ personDocumentId: coordinator });

			// Allowed: own-country institution, targeting ERIC.
			await expect(
				assertCanManageCountryInstitutionRelation(
					user,
					{ institutionDocumentId: institution, relatedUnitDocumentId: ericDocumentId },
					tx,
				),
			).resolves.toBeUndefined();

			// Denied: not targeting ERIC.
			await expect(
				assertCanManageCountryInstitutionRelation(
					user,
					{ institutionDocumentId: institution, relatedUnitDocumentId: country },
					tx,
				),
			).rejects.toThrow("REDIRECT");

			// Denied: institution located in a country the coordinator does not manage.
			await expect(
				assertCanManageCountryInstitutionRelation(
					user,
					{ institutionDocumentId: foreignInstitution, relatedUnitDocumentId: ericDocumentId },
					tx,
				),
			).rejects.toThrow("REDIRECT");
		});
	});

	it("assertCanEditCountryInstitution: allows own-country institutions, denies others", async () => {
		await withTransaction(async (tx) => {
			const country = await seedUnit(tx, "country");
			const coordinator = await seedPersonDocument(tx);
			await seedPersonRelation(tx, {
				personDocumentId: coordinator,
				organisationalUnitDocumentId: country,
				role: "national_coordinator",
			});

			const ownInstitution = await seedUnit(tx, "institution");
			await seedUnitRelation(tx, {
				unitDocumentId: ownInstitution,
				relatedUnitDocumentId: country,
				status: "is_located_in",
			});

			const otherCountry = await seedUnit(tx, "country");
			const foreignInstitution = await seedUnit(tx, "institution");
			await seedUnitRelation(tx, {
				unitDocumentId: foreignInstitution,
				relatedUnitDocumentId: otherCountry,
				status: "is_located_in",
			});

			const user = makeUser({ personDocumentId: coordinator });

			await expect(
				assertCanEditCountryInstitution(user, ownInstitution, tx),
			).resolves.toBeUndefined();
			await expect(assertCanEditCountryInstitution(user, foreignInstitution, tx)).rejects.toThrow(
				"REDIRECT",
			);
		});
	});
});
