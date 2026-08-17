"use server";

import { assert, keyBy } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import slugify from "@sindresorhus/slugify";

import { CreateDocumentationPageActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/documentation-pages/_lib/create-documentation-page.schema";
import { upsertTypedContentBlock } from "@/lib/content-blocks-service";
import { documentationPagesLifecycleAdapter } from "@/lib/data/documentation-pages.lifecycle-adapter";
import { createDraftDocument, publishVersion } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createDocumentationPageAction = createMutationAction({
	schema: CreateDocumentationPageActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "documentation_pages" },
	revalidate: "/[locale]/dashboard/administrator/documentation-pages",
	redirect: "/dashboard/administrator/documentation-pages",

	async mutate(tx, input, { formData }) {
		const slug = slugify(input.title);

		const type = await tx.query.entityTypes.findFirst({
			where: { type: "documentation_pages" },
			columns: { id: true },
		});
		assert(type);

		const { documentId, versionId } = await createDraftDocument(tx, type.id, slug);

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

		const contentBlockTypes = await db.query.contentBlockTypes.findMany();
		const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

		await Promise.all(
			input.contentBlocks.map(async (contentBlock, index) => {
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
			}),
		);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, documentId, documentationPagesLifecycleAdapter);
		}

		return {
			subjectId: documentId,
			auditSummary: {
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
			},
		};
	},
});
