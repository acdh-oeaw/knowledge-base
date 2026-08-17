"use server";

import { assert, keyBy } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateInternalPageActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_lib/update-internal-page.schema";
import { upsertTypedContentBlock } from "@/lib/content-blocks-service";
import { ensureDraftVersion, publishVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { ensureEntityVersionField } from "@/lib/data/entity-version-fields";
import { internalPagesLifecycleAdapter } from "@/lib/data/internal-pages.lifecycle-adapter";
import { db } from "@/lib/db";
import { eq, inArray } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateInternalPageAction = createMutationAction({
	schema: UpdateInternalPageActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "internal_pages" },
	revalidate: [
		"/[locale]/dashboard/administrator/internal-pages",
		"/[locale]/privacy-policy",
		"/[locale]/terms-of-use",
	],
	redirect: "/dashboard/administrator/internal-pages",

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(
			tx,
			input.documentId,
			internalPagesLifecycleAdapter,
		);

		await tx
			.update(schema.internalPages)
			.set({ title: input.title })
			.where(eq(schema.internalPages.id, draftVersionId));

		const contentField = await ensureEntityVersionField(tx, draftVersionId, "content");
		const contentBlockTypes = await db.query.contentBlockTypes.findMany();
		const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

		const keptIds = new Set(
			input.contentBlocks.filter((cb) => cb.position !== undefined).map((cb) => cb.id),
		);

		const existingBlocks = await tx.query.contentBlocks.findMany({
			where: { fieldId: contentField.id },
			columns: { id: true },
		});

		const toDelete = existingBlocks
			.filter((block) => !keptIds.has(block.id))
			.map((block) => block.id);

		if (toDelete.length > 0) {
			await tx.delete(schema.contentBlocks).where(inArray(schema.contentBlocks.id, toDelete));
		}

		await Promise.all(
			input.contentBlocks.map(async (contentBlock, index) => {
				const { id, position } = contentBlock;
				if (position !== undefined) {
					await tx
						.update(schema.contentBlocks)
						.set({
							fieldId: contentField.id,
							typeId: contentBlockTypesByType[contentBlock.type].id,
							position: index,
						})
						.where(eq(schema.contentBlocks.id, id));
					await upsertTypedContentBlock(tx, contentBlock, id, false);
				} else {
					const [added] = await tx
						.insert(schema.contentBlocks)
						.values({
							fieldId: contentField.id,
							typeId: contentBlockTypesByType[contentBlock.type].id,
							position: index,
						})
						.returning({ id: schema.contentBlocks.id });
					assert(added);
					await upsertTypedContentBlock(tx, contentBlock, added.id, true);
				}
			}),
		);

		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, internalPagesLifecycleAdapter);
		}

		return {
			subjectId: input.documentId,
			auditSummary: {
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
			},
		};
	},
});
