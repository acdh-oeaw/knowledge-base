"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdatePersonActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/update-person.schema";
import {
	ensureDraftVersion,
	getDocumentSlug,
	publishVersion,
	touchVersion,
	updateDraftDocumentSlug,
} from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { syncPersonSocialMedia } from "@/lib/data/person-social-media";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import { eq } from "@/lib/db/sql";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updatePersonAction = createMutationAction({
	schema: UpdatePersonActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "persons" },
	revalidate: "/[locale]/dashboard/administrator/persons",
	redirect: ({ result }) => `/dashboard/administrator/persons/${getResultSlug(result)}/details`,

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(tx, input.documentId, personsLifecycleAdapter);

		// The form only offers the slug while the document is draft-only; `updateDraftDocumentSlug`
		// re-checks that server-side, so a forged submission cannot rename a published page.
		const requestedSlug = getRequestedSlug(input.slug);
		if (requestedSlug != null) {
			await updateDraftDocumentSlug(tx, input.documentId, requestedSlug);
		}

		const asset =
			input.imageKey != null
				? await tx.query.assets.findFirst({
						where: { key: input.imageKey },
						columns: { id: true },
					})
				: null;
		assert(input.imageKey == null || asset != null);

		await tx
			.update(schema.persons)
			.set({
				email: input.email,
				imageId: asset?.id ?? null,
				imageCaption: input.imageCaption,
				imageCaptionMode: input.imageCaptionMode,
				name: input.name,
				orcid: input.orcid,
				sortName: input.sortName,
			})
			.where(eq(schema.persons.id, draftVersionId));

		await syncPersonSocialMedia(tx, draftVersionId, input.socialMedia);

		await replaceEntityVersionFieldContentBlocks(
			tx,
			draftVersionId,
			"biography",
			input.biographyContentBlocks,
		);
		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, personsLifecycleAdapter);
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
		await dispatchWebhook({ type: "persons" });
	},
});
