"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { CreateSpotlightArticleActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/create-spotlight-article.schema";
import { createDraftDocumentWithSlug, publishVersion } from "@/lib/data/entity-lifecycle";
import { insertContentBlockTree } from "@/lib/data/entity-version-fields";
import { filterToPublishedDocumentIds } from "@/lib/data/relations";
import { spotlightArticlesLifecycleAdapter } from "@/lib/data/spotlight-articles.lifecycle-adapter";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getCreatedSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createSpotlightArticleAction = createMutationAction({
	schema: CreateSpotlightArticleActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "spotlight_articles" },
	revalidate: "/[locale]/dashboard/website/spotlight-articles",
	redirect: ({ result }) =>
		`/dashboard/website/spotlight-articles/${getCreatedSlug(result)}/details`,

	async mutate(tx, input, { formData }) {
		const type = await tx.query.entityTypes.findFirst({
			where: { type: "spotlight_articles" },
			columns: { id: true },
		});
		assert(type);

		const { documentId, versionId, slug } = await createDraftDocumentWithSlug(tx, type.id, {
			requestedSlug: getRequestedSlug(input.slug),
			title: input.title,
		});

		const asset = await tx.query.assets.findFirst({
			where: { key: input.imageKey },
			columns: { id: true },
		});
		assert(asset);

		await tx.insert(schema.spotlightArticles).values({
			id: versionId,
			imageId: asset.id,
			imageCaption: input.imageCaption,
			imageCaptionMode: input.imageCaptionMode,
			publicationDate: input.publicationDate,
			title: input.title,
			summary: input.summary,
		});

		const publishedRelatedEntityIds = await filterToPublishedDocumentIds(
			tx,
			input.relatedEntityIds,
		);
		if (publishedRelatedEntityIds.length > 0) {
			await tx.insert(schema.entitiesToEntities).values(
				publishedRelatedEntityIds.map((relatedEntityId, position) => {
					return { entityId: documentId, position, relatedEntityId };
				}),
			);
		}

		if (input.relatedResourceIds.length > 0) {
			await tx.insert(schema.entitiesToResources).values(
				input.relatedResourceIds.map((resourceId, position) => {
					return { entityId: documentId, position, resourceId };
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

		await insertContentBlockTree(tx, contentField.id, input.contentBlocks);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, documentId, spotlightArticlesLifecycleAdapter);
		}

		return {
			subjectId: documentId,
			subjectSlug: slug,
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
		await dispatchWebhook({ type: "spotlight-articles" });
	},
});
