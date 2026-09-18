"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { normalizeEventDuration } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/event-duration";
import { UpdateEventActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/events/_lib/update-event.schema";
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
import { eventsLifecycleAdapter } from "@/lib/data/events.lifecycle-adapter";
import { getLocaleSearch } from "@/lib/data/locales";
import { syncEntityRelations } from "@/lib/data/relations";
import { eq } from "@/lib/db/sql";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateEventAction = createMutationAction<
	typeof UpdateEventActionInputSchema,
	{ localeSearch: string }
>({
	schema: UpdateEventActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "events" },
	revalidate: "/[locale]/dashboard/website/events",
	redirect: ({ result }) =>
		`/dashboard/website/events/${getResultSlug(result)}/details${result.successData?.localeSearch ?? ""}`,

	async mutate(tx, input, { formData }) {
		const { versionId: draftVersionId } = await ensureLocalizedDraftVersion(
			tx,
			input.documentId,
			eventsLifecycleAdapter,
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
			.update(schema.events)
			.set({
				imageId: asset.id,
				imageCaption: input.imageCaption,
				imageCaptionMode: input.imageCaptionMode,
				title: input.title,
				summary: input.summary,
				location: input.location,
				website: input.website,
				duration: normalizeEventDuration(input.duration, input.isFullDay),
				isFullDay: input.isFullDay,
			})
			.where(eq(schema.events.id, draftVersionId));

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
			await publishVersion(tx, input.documentId, eventsLifecycleAdapter, input.localeId);
		}

		return {
			subjectId: input.documentId,
			subjectSlug: await getDocumentSlug(tx, input.documentId, input.localeId),
			auditSummary: {
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
			},
			successData: { localeSearch: await getLocaleSearch(tx, input.localeId) },
		};
	},

	async postCommit({ result, ctx }) {
		if (!shouldSaveAndPublish(ctx.formData)) {
			return;
		}
		await syncWebsiteDocumentForEntity(result.subjectId);
		await dispatchWebhook({ tags: ["events"] });
	},
});
