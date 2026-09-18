"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateNewsItemActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/news/_lib/update-news-item.schema";
import {
	ensureLocalizedDraftVersion,
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
import { getLocaleSearch } from "@/lib/data/locales";
import { newsLifecycleAdapter } from "@/lib/data/news.lifecycle-adapter";
import { syncEntityRelations } from "@/lib/data/relations";
import { eq } from "@/lib/db/sql";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateNewsItemAction = createMutationAction<
	typeof UpdateNewsItemActionInputSchema,
	{ localeSearch: string }
>({
	schema: UpdateNewsItemActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "news" },
	revalidate: "/[locale]/dashboard/website/news",
	redirect: ({ result }) =>
		`/dashboard/website/news/${getResultSlug(result)}/details${result.successData?.localeSearch ?? ""}`,

	async mutate(tx, input, { formData }) {
		const { versionId: draftVersionId } = await ensureLocalizedDraftVersion(
			tx,
			input.documentId,
			newsLifecycleAdapter,
			input.localeId,
		);

		// The form only offers the slug while the document is draft-only; `updateDraftDocumentSlug`
		// re-checks that server-side, so a forged submission cannot rename a published page.
		const requestedSlug = getRequestedSlug(input.slug);
		if (requestedSlug != null) {
			await updateDraftDocumentSlug(tx, input.documentId, requestedSlug, input.localeId);
		}

		const asset = await tx.query.assets.findFirst({
			where: { key: input.imageKey },
			columns: { id: true },
		});
		assert(asset);

		await tx
			.update(schema.news)
			.set({
				imageId: asset.id,
				imageCaption: input.imageCaption,
				imageCaptionMode: input.imageCaptionMode,
				publicationDate: input.publicationDate,
				title: input.title,
				summary: input.summary,
			})
			.where(eq(schema.news.id, draftVersionId));

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
			await publishVersion(tx, input.documentId, newsLifecycleAdapter, input.localeId);
		}

		return {
			subjectId: input.documentId,
			subjectSlug: await getDocumentSlug(tx, input.documentId, input.localeId),
			successData: { localeSearch: await getLocaleSearch(tx, input.localeId) },
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
		await dispatchWebhook({ tags: ["news"] });
	},
});
