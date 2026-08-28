import { assert } from "@acdh-oeaw/lib";
import { faker as f } from "@faker-js/faker";
import slugify from "@sindresorhus/slugify";
import { describe, expect, it } from "vitest";

import { createDraftDocument } from "@/lib/data/entity-lifecycle";
import { mergeEntities } from "@/lib/data/entity-merge";
import type { db } from "@/lib/db";
import { withTransaction } from "@/test/lib/with-transaction";

type Tx = Awaited<Parameters<Parameters<typeof db.transaction>[0]>[0]>;

/** Create a bare (mergeable) entity document — enough to exercise the merge guards. */
async function seedEntity(tx: Tx): Promise<string> {
	const type = await tx.query.entityTypes.findFirst({
		where: { type: "news" },
		columns: { id: true },
	});
	assert(type, "news entity type not found in database");

	const slug = slugify(`${f.lorem.slug()}-${f.string.uuid()}`);
	const { documentId } = await createDraftDocument(tx, type.id, slug);
	return documentId;
}

describe("mergeEntities", () => {
	it("rejects merging an entity into itself and leaves it intact", async () => {
		await withTransaction(async (tx) => {
			const documentId = await seedEntity(tx);

			// A self-merge would re-point the entity's relations onto itself and then delete it, so the
			// guard must reject before any mutation runs.
			await expect(mergeEntities(tx, documentId, documentId)).rejects.toThrow(
				"Cannot merge an entity into itself.",
			);

			const stillThere = await tx.query.entities.findFirst({
				where: { id: documentId },
				columns: { id: true },
			});
			expect(stillThere?.id).toBe(documentId);
		});
	});
});
