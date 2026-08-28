"use server";

import * as schema from "@dariah-eric/database/schema";

import { UpdateInternalPageActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/internal-pages/_lib/update-internal-page.schema";
import {
	ensureDraftVersion,
	getDocumentSlug,
	publishVersion,
	touchVersion,
} from "@/lib/data/entity-lifecycle";
import {
	deleteFieldContentBlocks,
	ensureEntityVersionField,
	insertContentBlockTree,
} from "@/lib/data/entity-version-fields";
import { internalPagesLifecycleAdapter } from "@/lib/data/internal-pages.lifecycle-adapter";
import { eq } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";

export const updateInternalPageAction = createMutationAction({
	schema: UpdateInternalPageActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "internal_pages" },
	revalidate: [
		"/[locale]/dashboard/administrator/internal-pages",
		"/[locale]/privacy-policy",
		"/[locale]/terms-of-use",
	],
	redirect: ({ result }) =>
		`/dashboard/administrator/internal-pages/${getResultSlug(result)}/details`,

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
		await deleteFieldContentBlocks(tx, contentField.id);
		await insertContentBlockTree(tx, contentField.id, input.contentBlocks);

		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, internalPagesLifecycleAdapter);
		}

		return {
			subjectId: input.documentId,
			subjectSlug: await getDocumentSlug(tx, input.documentId),
			auditSummary: {
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
			},
		};
	},
});
