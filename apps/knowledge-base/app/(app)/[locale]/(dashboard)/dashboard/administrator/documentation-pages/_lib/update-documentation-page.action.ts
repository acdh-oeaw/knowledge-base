"use server";

import * as schema from "@dariah-eric/database/schema";

import { UpdateDocumentationPageActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/update-documentation-page.schema";
import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import {
	ensureDraftVersion,
	getDocumentSlug,
	publishVersion,
	touchVersion,
	updateDraftDocumentSlug,
} from "@/lib/data/entity-lifecycle";
import {
	deleteFieldContentBlocks,
	ensureEntityVersionField,
	insertContentBlockTree,
} from "@/lib/data/entity-version-fields";
import { eq } from "@/lib/db/sql";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";

export const updateDocumentationPageAction = createMutationAction({
	schema: UpdateDocumentationPageActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "documentation_pages" },
	revalidate: "/[locale]/dashboard/administrator/documentation-pages",
	redirect: ({ result }) =>
		`/dashboard/administrator/documentation-pages/${getResultSlug(result)}/details`,

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(
			tx,
			input.documentId,
			documentationPagesLifecycleAdapter,
		);

		// The form only offers the slug while the document is draft-only; `updateDraftDocumentSlug`
		// re-checks that server-side, so a forged submission cannot rename a published page.
		const requestedSlug = getRequestedSlug(input.slug);
		if (requestedSlug != null) {
			await updateDraftDocumentSlug(tx, input.documentId, requestedSlug);
		}

		await tx
			.update(schema.documentationPages)
			.set({ title: input.title })
			.where(eq(schema.documentationPages.id, draftVersionId));

		const contentField = await ensureEntityVersionField(tx, draftVersionId, "content");
		await deleteFieldContentBlocks(tx, contentField.id);
		await insertContentBlockTree(tx, contentField.id, input.contentBlocks);

		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, documentationPagesLifecycleAdapter);
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
