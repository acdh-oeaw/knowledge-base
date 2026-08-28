"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateSpotlightArticleActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/spotlight-articles/_lib/update-spotlight-article.schema";
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
import { syncEntityRelations } from "@/lib/data/relations";
import { spotlightArticlesLifecycleAdapter } from "@/lib/data/spotlight-articles.lifecycle-adapter";
import { eq } from "@/lib/db/sql";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateSpotlightArticleAction = createMutationAction({
	schema: UpdateSpotlightArticleActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "spotlight_articles" },
	revalidate: "/[locale]/dashboard/website/spotlight-articles",
	redirect: ({ result }) =>
		`/dashboard/website/spotlight-articles/${getResultSlug(result)}/details`,

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(
			tx,
			input.documentId,
			spotlightArticlesLifecycleAdapter,
		);

		// The form only offers the slug while the document is draft-only; `updateDraftDocumentSlug`
		// re-checks that server-side, so a forged submission cannot rename a published page.
		const requestedSlug = getRequestedSlug(input.slug);
		if (requestedSlug != null) {
			await updateDraftDocumentSlug(tx, input.documentId, requestedSlug);
		}

		const asset = await tx.query.assets.findFirst({
			where: { key: input.imageKey },
			columns: { id: true },
		});
		assert(asset);

		await tx
			.update(schema.spotlightArticles)
			.set({
				imageId: asset.id,
				imageCaption: input.imageCaption,
				imageCaptionMode: input.imageCaptionMode,
				publicationDate: input.publicationDate,
				title: input.title,
				summary: input.summary,
			})
			.where(eq(schema.spotlightArticles.id, draftVersionId));

		const contentField = await ensureEntityVersionField(tx, draftVersionId, "content");
		await deleteFieldContentBlocks(tx, contentField.id);

		await insertContentBlockTree(tx, contentField.id, input.contentBlocks);

		await syncEntityRelations(
			tx,
			input.documentId,
			input.relatedEntityIds,
			input.relatedResourceIds,
		);
		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, spotlightArticlesLifecycleAdapter);
		}

		return {
			subjectId: input.documentId,
			subjectSlug: await getDocumentSlug(tx, input.documentId),
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
