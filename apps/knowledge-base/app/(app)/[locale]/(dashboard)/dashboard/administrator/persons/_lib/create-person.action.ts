"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { CreatePersonActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/create-person.schema";
import { createDraftDocumentWithSlug, publishVersion } from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { syncPersonSocialMedia } from "@/lib/data/person-social-media";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getCreatedSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createPersonAction = createMutationAction({
	schema: CreatePersonActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "persons" },
	revalidate: "/[locale]/dashboard/administrator/persons",
	redirect: ({ result }) => `/dashboard/administrator/persons/${getCreatedSlug(result)}/details`,

	async mutate(tx, input, { formData }) {
		const type = await tx.query.entityTypes.findFirst({
			where: { type: "persons" },
			columns: { id: true },
		});
		assert(type);

		const { documentId, versionId, slug } = await createDraftDocumentWithSlug(tx, type.id, {
			requestedSlug: getRequestedSlug(input.slug),
			title: input.name,
		});

		const asset =
			input.imageKey != null
				? await tx.query.assets.findFirst({
						where: { key: input.imageKey },
						columns: { id: true },
					})
				: null;
		assert(input.imageKey == null || asset != null);

		await tx.insert(schema.persons).values({
			id: versionId,
			email: input.email,
			imageId: asset?.id ?? null,
			imageCaption: input.imageCaption,
			imageCaptionMode: input.imageCaptionMode,
			name: input.name,
			orcid: input.orcid,
			sortName: input.sortName,
		});

		await syncPersonSocialMedia(tx, versionId, input.socialMedia);

		await replaceEntityVersionFieldContentBlocks(
			tx,
			versionId,
			"biography",
			input.biographyContentBlocks,
		);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, documentId, personsLifecycleAdapter);
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
		await dispatchWebhook({ type: "persons" });
	},
});
