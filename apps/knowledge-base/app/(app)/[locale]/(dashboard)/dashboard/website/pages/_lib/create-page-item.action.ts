"use server";

import { assert, keyBy } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import slugify from "@sindresorhus/slugify";

import { CreatePageItemActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/pages/_lib/create-page-item.schema";
import { upsertTypedContentBlock } from "@/lib/content-blocks-service";
import { createDraftDocument, publishVersion } from "@/lib/data/entity-lifecycle";
import { pagesLifecycleAdapter } from "@/lib/data/pages.lifecycle-adapter";
import { filterToPublishedDocumentIds } from "@/lib/data/relations";
import { db } from "@/lib/db";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createPageItemAction = createMutationAction({
	schema: CreatePageItemActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "pages" },
	revalidate: "/[locale]/dashboard/website/pages",
	redirect: "/dashboard/website/pages",

	async mutate(tx, input, { formData }) {
		const slug = slugify(input.title);

		const type = await tx.query.entityTypes.findFirst({
			where: { type: "pages" },
			columns: { id: true },
		});
		assert(type);

		const { documentId, versionId } = await createDraftDocument(tx, type.id, slug);

		let imageId: string | undefined;
		if (input.imageKey != null) {
			const asset = await tx.query.assets.findFirst({
				where: { key: input.imageKey },
				columns: { id: true },
			});
			assert(asset);
			imageId = asset.id;
		}

		await tx.insert(schema.pages).values({
			id: versionId,
			imageId,
			title: input.title,
			summary: input.summary,
		});

		const publishedRelatedEntityIds = await filterToPublishedDocumentIds(
			tx,
			input.relatedEntityIds,
		);
		if (publishedRelatedEntityIds.length > 0) {
			await tx.insert(schema.entitiesToEntities).values(
				publishedRelatedEntityIds.map((relatedEntityId) => {
					return { entityId: documentId, relatedEntityId };
				}),
			);
		}

		if (input.relatedResourceIds.length > 0) {
			await tx.insert(schema.entitiesToResources).values(
				input.relatedResourceIds.map((resourceId) => {
					return { entityId: documentId, resourceId };
				}),
			);
		}

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
			await publishVersion(tx, documentId, pagesLifecycleAdapter);
		}

		return {
			subjectId: documentId,
			auditSummary: {
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
			},
		};
	},

	async postCommit({ result, ctx }) {
		if (!shouldSaveAndPublish(ctx.formData)) {
			return;
		}
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ type: "pages" });
	},
});
