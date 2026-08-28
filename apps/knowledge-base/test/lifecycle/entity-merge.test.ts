import { randomUUID } from "node:crypto";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { describe, expect, it } from "vitest";

import { createPublishedDocument } from "@/lib/data/entity-lifecycle";
import { mergeEntities } from "@/lib/data/entity-merge";
import type { Transaction } from "@/lib/db";
import { eq, sql } from "@/lib/db/sql";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Transaction;

async function getProjectTypeId(tx: Tx): Promise<string> {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "projects" },
		columns: { id: true },
	});
	assert(type, "projects entity type not found in database");
	return type.id;
}

async function getProjectRoleId(tx: Tx): Promise<string> {
	const role = await tx.query.projectRoles.findFirst({ columns: { id: true } });
	assert(role, "no project_roles seeded in database");
	return role.id;
}

/** Insert a bare entity document to act as an FK target (e.g. a project↔unit relation endpoint). */
async function createBareEntity(tx: Tx, typeId: string): Promise<string> {
	const [row] = await tx
		.insert(schema.entities)
		.values({ typeId })
		.returning({ id: schema.entities.id });
	assert(row);
	return row.id;
}

async function countProjectUnits(tx: Tx, projectDocumentId: string): Promise<number> {
	return tx
		.select({ n: sql<number>`count(*)::int` })
		.from(schema.projectsToOrganisationalUnits)
		.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, projectDocumentId))
		.then((r) => r[0]?.n ?? 0);
}

describe("mergeEntities", () => {
	it("re-points project→unit relations onto the target, deduping collisions, and deletes the source", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getProjectTypeId(tx);
			const roleId = await getProjectRoleId(tx);

			const source = await createPublishedDocument(tx, typeId, `merge-src-${randomUUID()}`);
			const target = await createPublishedDocument(tx, typeId, `merge-tgt-${randomUUID()}`);
			const unitA = await createBareEntity(tx, typeId);
			const unitB = await createBareEntity(tx, typeId);

			await tx.insert(schema.projectsToOrganisationalUnits).values([
				{ projectDocumentId: source.documentId, unitDocumentId: unitA, roleId },
				{ projectDocumentId: source.documentId, unitDocumentId: unitB, roleId },
				// Target already relates to unitA with the same role — the incoming source row collides.
				{ projectDocumentId: target.documentId, unitDocumentId: unitA, roleId },
			]);

			await mergeEntities(tx, source.documentId, target.documentId);

			// Source document is fully gone.
			expect(
				await tx.query.entities.findFirst({ where: { id: source.documentId } }),
			).toBeUndefined();
			expect(
				await tx
					.select({ id: schema.entityVersions.id })
					.from(schema.entityVersions)
					.where(eq(schema.entityVersions.entityId, source.documentId)),
			).toHaveLength(0);
			expect(await countProjectUnits(tx, source.documentId)).toBe(0);

			// Target keeps the distinct union of (unit, role) — unitA deduped, unitB moved.
			const units = await tx
				.select({ unit: schema.projectsToOrganisationalUnits.unitDocumentId })
				.from(schema.projectsToOrganisationalUnits)
				.where(eq(schema.projectsToOrganisationalUnits.projectDocumentId, target.documentId));
			expect(units.map((u) => u.unit).toSorted()).toStrictEqual([unitA, unitB].toSorted());
		});
	});

	it("dedupes without erroring when every incoming relation collides with the target", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getProjectTypeId(tx);
			const roleId = await getProjectRoleId(tx);

			const source = await createPublishedDocument(tx, typeId, `merge-src-${randomUUID()}`);
			const target = await createPublishedDocument(tx, typeId, `merge-tgt-${randomUUID()}`);
			const unitA = await createBareEntity(tx, typeId);
			const unitB = await createBareEntity(tx, typeId);

			await tx.insert(schema.projectsToOrganisationalUnits).values([
				{ projectDocumentId: source.documentId, unitDocumentId: unitA, roleId },
				{ projectDocumentId: source.documentId, unitDocumentId: unitB, roleId },
				// Target already holds a copy of every source relation → all collide.
				{ projectDocumentId: target.documentId, unitDocumentId: unitA, roleId },
				{ projectDocumentId: target.documentId, unitDocumentId: unitB, roleId },
			]);

			const targetBefore = await countProjectUnits(tx, target.documentId);

			await mergeEntities(tx, source.documentId, target.documentId);

			expect(await countProjectUnits(tx, target.documentId)).toBe(targetBefore);
			expect(
				await tx.query.entities.findFirst({ where: { id: source.documentId } }),
			).toBeUndefined();
		});
	});

	it("re-points self-referential entities_to_entities on both endpoints, dropping self-relations and dedup", async () => {
		await withTransaction(async (tx) => {
			const typeId = await getProjectTypeId(tx);

			const source = await createPublishedDocument(tx, typeId, `merge-src-${randomUUID()}`);
			const target = await createPublishedDocument(tx, typeId, `merge-tgt-${randomUUID()}`);
			const otherId = await createBareEntity(tx, typeId);

			await tx.insert(schema.entitiesToEntities).values([
				{ entityId: source.documentId, relatedEntityId: otherId, position: 0 }, // → (target, other)
				{ entityId: otherId, relatedEntityId: source.documentId, position: 0 }, // → (other, target)
				{ entityId: source.documentId, relatedEntityId: target.documentId, position: 0 }, // self-loop → dropped
				{ entityId: target.documentId, relatedEntityId: otherId, position: 0 }, // collides with (target, other)
			]);

			await mergeEntities(tx, source.documentId, target.documentId);

			const rows = await tx
				.select({
					entityId: schema.entitiesToEntities.entityId,
					relatedEntityId: schema.entitiesToEntities.relatedEntityId,
				})
				.from(schema.entitiesToEntities)
				.where(
					sql`${schema.entitiesToEntities.entityId} in (${source.documentId}, ${target.documentId}, ${otherId})
						or ${schema.entitiesToEntities.relatedEntityId} in (${source.documentId}, ${target.documentId}, ${otherId})`,
				);

			const pairs = rows.map((r) => `${r.entityId}->${r.relatedEntityId}`).toSorted();

			// No row references the deleted source; (target,other) deduped to one; (other,target) moved;
			// the (source,target) self-loop is gone.
			expect(pairs).toStrictEqual(
				[`${otherId}->${target.documentId}`, `${target.documentId}->${otherId}`].toSorted(),
			);

			const sourceEntity = await tx.query.entities.findFirst({
				where: { id: source.documentId },
			});
			expect(sourceEntity).toBeUndefined();
		});
	});
});
