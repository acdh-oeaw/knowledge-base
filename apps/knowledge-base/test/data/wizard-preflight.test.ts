import { randomUUID } from "node:crypto";

import { assert, getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import { RetireUnitActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/retire-unit.schema";
import {
	getExistingPersonRelations,
	isRelationAlreadyRecorded,
	resolveCountryRoleCounterpart,
	resolveOpenCounterpartToEnd,
	toInterval,
	widenDuration,
} from "@/lib/data/wizard-preflight";
import type { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>;

const date = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

/**
 * The paired-relation rules are duration-sensitive, and the guided forms act on that: they skip a
 * counterpart that is already covered, widen one that overlaps, and close one when the appointment
 * ends. Those decisions are interval arithmetic over rows the admin never sees directly, so they
 * are exercised here rather than only through the browser.
 */

describe("widenDuration", () => {
	it("extends an existing period at both ends to cover the requested one", () => {
		const result = widenDuration(
			{ start: date("2021-01-01"), end: date("2022-01-01") },
			{ start: date("2020-01-01"), end: date("2023-01-01") },
		);

		expect(result).toStrictEqual({ start: date("2020-01-01"), end: date("2023-01-01") });
	});

	it("keeps the wider existing bounds when the requested period sits inside them", () => {
		const result = widenDuration(
			{ start: date("2020-01-01"), end: date("2025-01-01") },
			{ start: date("2021-01-01"), end: date("2022-01-01") },
		);

		expect(result).toStrictEqual({ start: date("2020-01-01"), end: date("2025-01-01") });
	});

	/**
	 * An open-ended relation already covers everything after its start, so capping it would narrow
	 * rather than widen — the one case where "widen" must mean "leave the end alone".
	 */
	it("leaves an ongoing existing relation ongoing", () => {
		const result = widenDuration(
			{ start: date("2021-01-01") },
			{ start: date("2020-01-01"), end: date("2022-01-01") },
		);

		expect(result).toStrictEqual({ start: date("2020-01-01") });
		expect(result).not.toHaveProperty("end");
	});

	it("drops the end when the requested period is ongoing", () => {
		const result = widenDuration(
			{ start: date("2021-01-01"), end: date("2022-01-01") },
			{ start: date("2021-06-01"), end: null },
		);

		expect(result).toStrictEqual({ start: date("2021-01-01") });
		expect(result).not.toHaveProperty("end");
	});
});

describe("isRelationAlreadyRecorded", () => {
	const relation = (start: string, end?: string) => {
		return {
			id: randomUUID(),
			statusType: "is_located_in" as const,
			relatedUnitDocumentId: "country-a",
			start: date(start),
			...(end != null ? { end: date(end) } : {}),
		};
	};

	it("treats a period fully inside an existing relation as recorded", () => {
		const existing = [relation("2020-01-01", "2025-01-01")];

		expect(
			isRelationAlreadyRecorded(
				existing,
				"is_located_in",
				"country-a",
				toInterval("2021-01-01", "2022-01-01"),
			),
		).toBe(true);
	});

	it("treats a partially covered period as not recorded", () => {
		const existing = [relation("2021-01-01", "2022-01-01")];

		expect(
			isRelationAlreadyRecorded(
				existing,
				"is_located_in",
				"country-a",
				toInterval("2020-01-01", "2023-01-01"),
			),
		).toBe(false);
	});

	it("counts an ongoing relation as covering any later period", () => {
		const existing = [relation("2020-01-01")];

		expect(
			isRelationAlreadyRecorded(
				existing,
				"is_located_in",
				"country-a",
				toInterval("2030-01-01", null),
			),
		).toBe(true);
	});

	it("combines adjacent relations when deciding coverage", () => {
		const existing = [relation("2020-01-01", "2022-01-01"), relation("2022-01-01", "2024-01-01")];

		expect(
			isRelationAlreadyRecorded(
				existing,
				"is_located_in",
				"country-a",
				toInterval("2021-01-01", "2023-01-01"),
			),
		).toBe(true);
	});

	it("ignores relations of another status or to another unit", () => {
		const existing = [relation("2020-01-01")];

		expect(
			isRelationAlreadyRecorded(
				existing,
				"is_member_of",
				"country-a",
				toInterval("2021-01-01", "2022-01-01"),
			),
		).toBe(false);
		expect(
			isRelationAlreadyRecorded(
				existing,
				"is_located_in",
				"country-b",
				toInterval("2021-01-01", "2022-01-01"),
			),
		).toBe(false);
	});
});

/**
 * The retire wizard's review step lets rows be unchecked, so the selection is posted as dot-indexed
 * form fields. A change in that serialisation would silently end fewer relations than the review
 * promised, with no error anywhere — hence a round-trip through the real parsing path.
 */
describe("RetireUnitActionInputSchema", () => {
	it("parses the dot-indexed relation id arrays the review step posts", () => {
		const unitDocumentId = randomUUID();
		const unitRelationIds = [randomUUID(), randomUUID()];
		const personRelationIds = [randomUUID()];

		const formData = new FormData();
		formData.set("unitDocumentId", unitDocumentId);
		formData.set("end", "2026-06-30");
		unitRelationIds.forEach((id, index) => {
			formData.set(`unitRelationIds.${String(index)}`, id);
		});
		personRelationIds.forEach((id, index) => {
			formData.set(`personRelationIds.${String(index)}`, id);
		});

		const result = v.safeParse(RetireUnitActionInputSchema, getFormDataValues(formData));

		expect(result.success).toBe(true);
		assert(result.success);
		expect(result.output.unitDocumentId).toBe(unitDocumentId);
		expect(result.output.end).toStrictEqual(date("2026-06-30"));
		expect(result.output.unitRelationIds).toStrictEqual(unitRelationIds);
		expect(result.output.personRelationIds).toStrictEqual(personRelationIds);
	});

	it("defaults both id arrays to empty when everything was unchecked", () => {
		const formData = new FormData();
		formData.set("unitDocumentId", randomUUID());
		formData.set("end", "2026-06-30");

		const result = v.safeParse(RetireUnitActionInputSchema, getFormDataValues(formData));

		expect(result.success).toBe(true);
		assert(result.success);
		expect(result.output.unitRelationIds).toStrictEqual([]);
		expect(result.output.personRelationIds).toStrictEqual([]);
	});
});

// ---------------------------------------------------------------------------
// Database-backed: counterpart resolution against real rows
// ---------------------------------------------------------------------------

async function seedGovernanceBody(tx: Tx, slug: string): Promise<string> {
	const entityType = await tx.query.entityTypes.findFirst({
		where: { type: "organisational_units" },
		columns: { id: true },
	});
	assert(entityType);

	const status = await tx.query.entityStatus.findFirst({
		where: { type: "published" },
		columns: { id: true },
	});
	assert(status);

	const unitType = await tx.query.organisationalUnitTypes.findFirst({
		where: { type: "governance_body" },
		columns: { id: true },
	});
	assert(unitType);

	const defaultLocale = await tx.query.locales.findFirst({
		where: { isDefault: true },
		columns: { id: true },
	});
	assert(defaultLocale);
	const localeId = defaultLocale.id;

	const [document] = await tx
		.insert(schema.entities)
		.values({ typeId: entityType.id })
		.returning({ id: schema.entities.id });
	assert(document);

	const [version] = await tx
		.insert(schema.entityVersions)
		.values({ entityId: document.id, statusId: status.id, localeId })
		.returning({ id: schema.entityVersions.id });
	assert(version);

	await tx.insert(schema.slugs).values({
		entityVersionId: version.id,
		entityId: document.id,
		typeId: entityType.id,
		localeId,
		isPublished: true,
		value: slug,
	});

	await tx
		.insert(schema.organisationalUnits)
		.values({ id: version.id, name: `Body ${slug}`, typeId: unitType.id });

	return document.id;
}

async function seedPerson(tx: Tx, name: string): Promise<string> {
	const entityType = await tx.query.entityTypes.findFirst({
		where: { type: "persons" },
		columns: { id: true },
	});
	assert(entityType);

	const status = await tx.query.entityStatus.findFirst({
		where: { type: "published" },
		columns: { id: true },
	});
	assert(status);

	const defaultLocale = await tx.query.locales.findFirst({
		where: { isDefault: true },
		columns: { id: true },
	});
	assert(defaultLocale);
	const localeId = defaultLocale.id;

	const [document] = await tx
		.insert(schema.entities)
		.values({ typeId: entityType.id })
		.returning({ id: schema.entities.id });
	assert(document);

	const [version] = await tx
		.insert(schema.entityVersions)
		.values({ entityId: document.id, statusId: status.id, localeId })
		.returning({ id: schema.entityVersions.id });
	assert(version);

	await tx.insert(schema.slugs).values({
		entityVersionId: version.id,
		entityId: document.id,
		typeId: entityType.id,
		localeId,
		isPublished: true,
		value: `person-${randomUUID()}`,
	});

	await tx.insert(schema.persons).values({ id: version.id, name, sortName: name });

	return document.id;
}

async function seedPersonRelation(
	tx: Tx,
	params: {
		personDocumentId: string;
		organisationalUnitDocumentId: string;
		roleType: (typeof schema.personRoleTypesEnum)[number];
		start: Date;
		end?: Date;
	},
): Promise<string> {
	const roleType = await tx.query.personRoleTypes.findFirst({
		where: { type: params.roleType },
		columns: { id: true },
	});
	assert(roleType, `Missing person role type "${params.roleType}".`);

	const [row] = await tx
		.insert(schema.personsToOrganisationalUnits)
		.values({
			personDocumentId: params.personDocumentId,
			organisationalUnitDocumentId: params.organisationalUnitDocumentId,
			roleTypeId: roleType.id,
			duration: { start: params.start, ...(params.end != null ? { end: params.end } : {}) },
		})
		.returning({ id: schema.personsToOrganisationalUnits.id });
	assert(row);

	return row.id;
}

/**
 * The National Coordinator Committee is pinned by slug in `pairedRelationRules`. A seeded database
 * may or may not contain it, so the tests create it when it is missing — inside a transaction that
 * is rolled back either way.
 */
async function ensureCommittee(tx: Tx): Promise<string> {
	const existing = await tx
		.select({ id: schema.slugs.entityId })
		.from(schema.slugs)
		.where(eq(schema.slugs.value, "national-coordinator-committee"))
		.limit(1);

	return existing[0]?.id ?? (await seedGovernanceBody(tx, "national-coordinator-committee"));
}

describe("resolveCountryRoleCounterpart", () => {
	it("creates plain membership by default and reports nothing covering the period", async () => {
		await withTransaction(async (tx) => {
			const committee = await ensureCommittee(tx);
			const person = await seedPerson(tx, "Counterpart Default");

			const existing = await getExistingPersonRelations(tx, person);
			const counterpart = await resolveCountryRoleCounterpart(
				tx,
				"national_coordinator",
				existing,
				toInterval("2026-01-01", null),
			);

			assert(counterpart);
			expect(counterpart.rule).toBe("national-coordinator-ncc");
			expect(counterpart.unit.documentId).toBe(committee);
			expect(counterpart.createAsRoleType).toBe("is_member_of");
			expect(counterpart.isCovered).toBe(false);
			expect(counterpart.rowToWiden).toBeNull();
			expect(counterpart.coveringRoleType).toBeNull();
		});
	});

	it("honours an explicitly requested role the rule accepts", async () => {
		await withTransaction(async (tx) => {
			await ensureCommittee(tx);
			const person = await seedPerson(tx, "Counterpart Chair");

			const counterpart = await resolveCountryRoleCounterpart(
				tx,
				"national_coordinator",
				await getExistingPersonRelations(tx, person),
				toInterval("2026-01-01", null),
				"is_chair_of",
			);

			assert(counterpart);
			expect(counterpart.createAsRoleType).toBe("is_chair_of");
		});
	});

	/** A role the rule does not accept must never be written, however it arrives. */
	it("falls back to the default when the requested role is not accepted by the rule", async () => {
		await withTransaction(async (tx) => {
			await ensureCommittee(tx);
			const person = await seedPerson(tx, "Counterpart Bogus");

			const counterpart = await resolveCountryRoleCounterpart(
				tx,
				"national_representative",
				await getExistingPersonRelations(tx, person),
				toInterval("2026-01-01", null),
				// Accepted by the committee rule, but not by the General Assembly one.
				"is_chair_of",
			);

			assert(counterpart);
			expect(counterpart.acceptedRoleTypes).toStrictEqual(["is_member_of"]);
			expect(counterpart.createAsRoleType).toBe("is_member_of");
		});
	});

	/**
	 * Chairing the committee counts as being on it, so a chair needs no membership row on top — and
	 * the review step must say which role is actually on record, not the one that was asked for.
	 */
	it("treats an existing chairship as covering a requested membership", async () => {
		await withTransaction(async (tx) => {
			const committee = await ensureCommittee(tx);
			const person = await seedPerson(tx, "Counterpart Existing Chair");

			await seedPersonRelation(tx, {
				personDocumentId: person,
				organisationalUnitDocumentId: committee,
				roleType: "is_chair_of",
				start: date("2020-01-01"),
			});

			const counterpart = await resolveCountryRoleCounterpart(
				tx,
				"national_coordinator",
				await getExistingPersonRelations(tx, person),
				toInterval("2026-01-01", null),
			);

			assert(counterpart);
			expect(counterpart.isCovered).toBe(true);
			expect(counterpart.coveringRoleType).toBe("is_chair_of");
			expect(counterpart.rowToWiden).toBeNull();
		});
	});

	it("marks an overlapping but shorter counterpart for widening", async () => {
		await withTransaction(async (tx) => {
			const committee = await ensureCommittee(tx);
			const person = await seedPerson(tx, "Counterpart Mismatch");

			const relationId = await seedPersonRelation(tx, {
				personDocumentId: person,
				organisationalUnitDocumentId: committee,
				roleType: "is_member_of",
				start: date("2026-06-01"),
				end: date("2026-12-31"),
			});

			const counterpart = await resolveCountryRoleCounterpart(
				tx,
				"national_coordinator",
				await getExistingPersonRelations(tx, person),
				toInterval("2026-01-01", "2027-12-31"),
			);

			assert(counterpart);
			expect(counterpart.isCovered).toBe(false);
			expect(counterpart.rowToWiden?.id).toBe(relationId);
		});
	});
});

describe("resolveOpenCounterpartToEnd", () => {
	it("finds the still-open counterpart, whatever accepted role it holds", async () => {
		await withTransaction(async (tx) => {
			const committee = await ensureCommittee(tx);
			const person = await seedPerson(tx, "End Counterpart Chair");

			const relationId = await seedPersonRelation(tx, {
				personDocumentId: person,
				organisationalUnitDocumentId: committee,
				roleType: "is_vice_chair_of",
				start: date("2020-01-01"),
			});

			const counterpart = await resolveOpenCounterpartToEnd(
				tx,
				"national_coordinator",
				await getExistingPersonRelations(tx, person),
			);

			assert(counterpart);
			expect(counterpart.relationId).toBe(relationId);
			expect(counterpart.roleType).toBe("is_vice_chair_of");
			expect(counterpart.start).toStrictEqual(date("2020-01-01"));
		});
	});

	it("ignores a counterpart that has already been ended", async () => {
		await withTransaction(async (tx) => {
			const committee = await ensureCommittee(tx);
			const person = await seedPerson(tx, "End Counterpart Closed");

			await seedPersonRelation(tx, {
				personDocumentId: person,
				organisationalUnitDocumentId: committee,
				roleType: "is_member_of",
				start: date("2020-01-01"),
				end: date("2024-01-01"),
			});

			const counterpart = await resolveOpenCounterpartToEnd(
				tx,
				"national_coordinator",
				await getExistingPersonRelations(tx, person),
			);

			expect(counterpart).toBeNull();
		});
	});
});
