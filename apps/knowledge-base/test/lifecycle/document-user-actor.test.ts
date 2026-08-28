import { randomBytes, randomUUID } from "node:crypto";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { describe, expect, it } from "vitest";

import { assertDocumentNotLinkedToUser } from "@/lib/data/entity-lifecycle";
import type { Transaction } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { UserFacingError } from "@/lib/user-facing-error";
import { withTransaction } from "@/test/lib/with-transaction";

async function createEntity(tx: Transaction, type: schema.EntityType["type"]): Promise<string> {
	const entityType = await tx.query.entityTypes.findFirst({
		where: { type },
		columns: { id: true },
	});
	assert(entityType, `${type} entity type not found in database`);

	const [entity] = await tx
		.insert(schema.entities)
		.values({ typeId: entityType.id })
		.returning({ id: schema.entities.id });
	assert(entity);

	return entity.id;
}

async function createUser(
	tx: Transaction,
	actor: { personDocumentId?: string; organisationalUnitDocumentId?: string },
): Promise<string> {
	const [user] = await tx
		.insert(schema.users)
		.values({
			email: `${randomUUID()}@example.com`,
			name: "test-user",
			passwordHash: "not-a-real-hash",
			twoFactorRecoveryCode: randomBytes(16),
			...actor,
		})
		.returning({ id: schema.users.id });
	assert(user);

	return user.id;
}

/**
 * `users.person_document_id` / `users.organisational_unit_document_id` reference `entities.id`
 * without a cascade, so deleting a linked document fails at the database anyway. What this pins is
 * that it fails _before_ that, as a refusal the admin can act on — and that the refusal is scoped
 * to documents an account actually names, so ordinary deletes stay unaffected.
 */
describe("assertDocumentNotLinkedToUser", () => {
	it("refuses a person document a user names as its actor", async () => {
		await withTransaction(async (tx) => {
			const personDocumentId = await createEntity(tx, "persons");
			await createUser(tx, { personDocumentId });

			await expect(assertDocumentNotLinkedToUser(tx, personDocumentId)).rejects.toThrow(
				UserFacingError,
			);
		});
	});

	it("refuses an organisational-unit document a user names as its actor", async () => {
		await withTransaction(async (tx) => {
			const organisationalUnitDocumentId = await createEntity(tx, "organisational_units");
			await createUser(tx, { organisationalUnitDocumentId });

			await expect(assertDocumentNotLinkedToUser(tx, organisationalUnitDocumentId)).rejects.toThrow(
				UserFacingError,
			);
		});
	});

	it("allows a document no user names", async () => {
		await withTransaction(async (tx) => {
			const personDocumentId = await createEntity(tx, "persons");
			const otherPersonDocumentId = await createEntity(tx, "persons");
			await createUser(tx, { personDocumentId: otherPersonDocumentId });

			await expect(assertDocumentNotLinkedToUser(tx, personDocumentId)).resolves.toBeUndefined();
		});
	});

	it("allows a document once the user's link has been cleared", async () => {
		await withTransaction(async (tx) => {
			const personDocumentId = await createEntity(tx, "persons");
			const userId = await createUser(tx, { personDocumentId });

			await tx
				.update(schema.users)
				.set({ personDocumentId: null })
				.where(eq(schema.users.id, userId));

			await expect(assertDocumentNotLinkedToUser(tx, personDocumentId)).resolves.toBeUndefined();
		});
	});
});
