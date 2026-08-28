"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { CreateDocumentationPageActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/create-documentation-page.schema";
import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import { createDraftDocumentWithSlug, publishVersion } from "@/lib/data/entity-lifecycle";
import { insertContentBlockTree } from "@/lib/data/entity-version-fields";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { createMutationAction, getCreatedSlug } from "@/lib/server/create-mutation-action";

export const createDocumentationPageAction = createMutationAction({
	schema: CreateDocumentationPageActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "documentation_pages" },
	revalidate: "/[locale]/dashboard/administrator/documentation-pages",
	redirect: ({ result }) =>
		`/dashboard/administrator/documentation-pages/${getCreatedSlug(result)}/details`,

	async mutate(tx, input, { formData }) {
		const type = await tx.query.entityTypes.findFirst({
			where: { type: "documentation_pages" },
			columns: { id: true },
		});
		assert(type);

		const { documentId, versionId, slug } = await createDraftDocumentWithSlug(tx, type.id, {
			requestedSlug: getRequestedSlug(input.slug),
			title: input.title,
		});

		await tx.insert(schema.documentationPages).values({
			id: versionId,
			title: input.title,
		});

		const contentFieldName = await tx.query.entityTypesFieldsNames.findFirst({
			where: { entityTypeId: type.id, fieldName: "content" },
			columns: { id: true },
		});
		assert(contentFieldName);

		const [contentField] = await tx
			.insert(schema.fields)
			.values({ entityVersionId: versionId, fieldNameId: contentFieldName.id })
			.returning({ id: schema.fields.id });
		assert(contentField);

		await insertContentBlockTree(tx, contentField.id, input.contentBlocks);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, documentId, documentationPagesLifecycleAdapter);
		}

		return {
			subjectId: documentId,
			subjectSlug: slug,
			auditSummary: {
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
			},
		};
	},
});
