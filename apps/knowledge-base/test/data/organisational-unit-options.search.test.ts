import { randomUUID } from "node:crypto";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { getOrganisationalUnitOptions } from "@/lib/data/organisational-units";
import type { db } from "@/lib/db";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>;

/**
 * The unit pickers (the guided forms, the services form, the `/api/organisational-units/options`
 * route) search the subtype table directly, not `entities.label` — the label only exists for
 * published versions, and these pickers also offer drafts. So the acronym has to be matched
 * explicitly, and that is what these tests pin down: institutions are routinely known by their
 * acronym only, and typing it must find them here just as it does in the institutions table.
 */
async function seedUnit(
	tx: Tx,
	options: Readonly<{ name: string; acronym?: string; state?: "draft" | "published" }>,
): Promise<string> {
	const { name, acronym, state = "published" } = options;

	const entityType = await tx.query.entityTypes.findFirst({
		where: { type: "organisational_units" },
		columns: { id: true },
	});
	assert(entityType, "organisational_units entity type not found in database");

	const status = await tx.query.entityStatus.findFirst({
		where: { type: state },
		columns: { id: true },
	});
	assert(status, `${state} entity status not found in database`);

	const unitType = await tx.query.organisationalUnitTypes.findFirst({
		where: { type: "institution" },
		columns: { id: true },
	});
	assert(unitType, "institution organisational-unit type not found in database");

	const defaultLocale = await tx.query.locales.findFirst({
		where: { isDefault: true },
		columns: { id: true },
	});
	assert(defaultLocale, "default locale not found in database");

	const [document] = await tx
		.insert(schema.entities)
		.values({ typeId: entityType.id })
		.returning({ id: schema.entities.id });
	assert(document);

	const [version] = await tx
		.insert(schema.entityVersions)
		.values({ entityId: document.id, statusId: status.id, localeId: defaultLocale.id })
		.returning({ id: schema.entityVersions.id });
	assert(version);

	await tx.insert(schema.slugs).values({
		entityVersionId: version.id,
		entityId: document.id,
		typeId: entityType.id,
		localeId: defaultLocale.id,
		isPublished: state === "published",
		value: `institution-${randomUUID()}`,
	});

	await tx
		.insert(schema.organisationalUnits)
		.values({ id: version.id, name, acronym, typeId: unitType.id });

	return document.id;
}

describe("getOrganisationalUnitOptions search", () => {
	it("finds an institution by its acronym", async () => {
		await withTransaction(async (tx) => {
			const acronym = `ACR${f.string.alpha(6).toUpperCase()}`;
			const documentId = await seedUnit(tx, {
				name: `Acronym Search Institution ${f.string.alphanumeric(8)}`,
				acronym,
			});

			const { items } = await getOrganisationalUnitOptions(
				{ q: acronym, unitType: "institution" },
				tx,
			);

			expect(items.map((item) => item.documentId)).toContain(documentId);
		});
	});

	it("finds a draft institution by its acronym when drafts are included", async () => {
		await withTransaction(async (tx) => {
			// The guided forms offer drafts, which have no `entities.label` yet — the acronym match has
			// to come from the subtype table for these to be findable at all.
			const acronym = `ACR${f.string.alpha(6).toUpperCase()}`;
			const documentId = await seedUnit(tx, {
				name: `Draft Acronym Institution ${f.string.alphanumeric(8)}`,
				acronym,
				state: "draft",
			});

			const { items } = await getOrganisationalUnitOptions(
				{ q: acronym, unitType: "institution", includeDrafts: true },
				tx,
			);

			expect(items.map((item) => item.documentId)).toContain(documentId);
		});
	});

	it("still finds an institution by its name", async () => {
		await withTransaction(async (tx) => {
			const suffix = f.string.alphanumeric(8);
			const documentId = await seedUnit(tx, {
				name: `Name Search Institution ${suffix}`,
				acronym: `ACR${f.string.alpha(6).toUpperCase()}`,
			});

			const { items } = await getOrganisationalUnitOptions(
				{ q: `institution ${suffix}`, unitType: "institution" },
				tx,
			);

			expect(items.map((item) => item.documentId)).toContain(documentId);
		});
	});

	it("requires every term to match, across name and acronym together", async () => {
		await withTransaction(async (tx) => {
			const suffix = f.string.alphanumeric(8);
			const acronym = `ACR${f.string.alpha(6).toUpperCase()}`;
			const documentId = await seedUnit(tx, {
				name: `Combined Search Institution ${suffix}`,
				acronym,
			});

			// One term matches the acronym, the other the name: both must be satisfied, but they may be
			// satisfied by different columns.
			const combined = await getOrganisationalUnitOptions(
				{ q: `${acronym} ${suffix}`, unitType: "institution" },
				tx,
			);
			expect(combined.items.map((item) => item.documentId)).toContain(documentId);

			// A term that matches neither column must still exclude the unit.
			const unmatched = await getOrganisationalUnitOptions(
				{ q: `${acronym} zzznotpresent`, unitType: "institution" },
				tx,
			);
			expect(unmatched.items.map((item) => item.documentId)).not.toContain(documentId);
		});
	});
});
