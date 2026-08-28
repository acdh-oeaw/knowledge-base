import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { faker as f } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { createDraftDocument } from "@/lib/data/entity-lifecycle";
import { getMaintenanceEntityOptions } from "@/lib/data/maintenance-entity-options";
import type { db } from "@/lib/db";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>;

/**
 * The maintenance picker resolves its label from the subtype tables rather than `entities.label`,
 * precisely so never-published drafts can be found — which also means it has to match the acronym
 * itself. Projects and organisational units are the two subtypes that carry one, and both are
 * routinely referred to by acronym alone.
 */
async function seedDraftProject(tx: Tx, name: string, acronym: string): Promise<string> {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "projects" },
		columns: { id: true },
	});
	assert(type, "projects entity type not found in database");
	const scope = await tx.query.projectScopes.findFirst({ columns: { id: true } });
	assert(scope, "project scope not found in database");

	const { documentId, versionId } = await createDraftDocument(
		tx,
		type.id,
		`draft-project-${f.string.alphanumeric(10).toLowerCase()}`,
	);
	await tx.insert(schema.projects).values({
		acronym,
		duration: { start: new Date("2026-01-01T00:00:00.000Z") },
		id: versionId,
		name,
		scopeId: scope.id,
	});

	return documentId;
}

async function seedDraftInstitution(tx: Tx, name: string, acronym: string): Promise<string> {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "organisational_units" },
		columns: { id: true },
	});
	assert(type, "organisational_units entity type not found in database");
	const unitType = await tx.query.organisationalUnitTypes.findFirst({
		where: { type: "institution" },
		columns: { id: true },
	});
	assert(unitType, "institution organisational-unit type not found in database");

	const { documentId, versionId } = await createDraftDocument(
		tx,
		type.id,
		`draft-institution-${f.string.alphanumeric(10).toLowerCase()}`,
	);
	await tx
		.insert(schema.organisationalUnits)
		.values({ acronym, id: versionId, name, typeId: unitType.id });

	return documentId;
}

describe("getMaintenanceEntityOptions search", () => {
	it("finds a never-published project by its acronym", async () => {
		await withTransaction(async (tx) => {
			const acronym = `ACR${f.string.alpha(6).toUpperCase()}`;
			const documentId = await seedDraftProject(
				tx,
				`Maintenance Acronym Project ${f.string.alphanumeric(8)}`,
				acronym,
			);

			const { items } = await getMaintenanceEntityOptions({ q: acronym }, tx);

			expect(items.map((item) => item.id)).toContain(documentId);
		});
	});

	it("finds a never-published institution by its acronym", async () => {
		await withTransaction(async (tx) => {
			const acronym = `ACR${f.string.alpha(6).toUpperCase()}`;
			const documentId = await seedDraftInstitution(
				tx,
				`Maintenance Acronym Institution ${f.string.alphanumeric(8)}`,
				acronym,
			);

			const { items } = await getMaintenanceEntityOptions({ q: acronym }, tx);

			expect(items.map((item) => item.id)).toContain(documentId);
		});
	});

	it("still finds a project by name, and keeps the name as the display label", async () => {
		await withTransaction(async (tx) => {
			const suffix = f.string.alphanumeric(8);
			const name = `Maintenance Name Project ${suffix}`;
			const documentId = await seedDraftProject(tx, name, `ACR${f.string.alpha(6).toUpperCase()}`);

			const { items } = await getMaintenanceEntityOptions({ q: `project ${suffix}` }, tx);

			expect(items).toContainEqual(expect.objectContaining({ id: documentId, name }));
		});
	});

	it("requires every term to match across slug, label and acronym", async () => {
		await withTransaction(async (tx) => {
			const acronym = `ACR${f.string.alpha(6).toUpperCase()}`;
			const documentId = await seedDraftProject(
				tx,
				`Maintenance Combined Project ${f.string.alphanumeric(8)}`,
				acronym,
			);

			const { items } = await getMaintenanceEntityOptions({ q: `${acronym} zzznotpresent` }, tx);

			expect(items.map((item) => item.id)).not.toContain(documentId);
		});
	});
});
