"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdatePersonActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/persons/_lib/update-person.schema";
import { ensureDraftVersion, publishVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { personsLifecycleAdapter } from "@/lib/data/persons.lifecycle-adapter";
import { eq } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updatePersonAction = createMutationAction({
	schema: UpdatePersonActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "persons" },
	revalidate: "/[locale]/dashboard/administrator/persons",
	redirect: "/dashboard/administrator/persons",

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(tx, input.documentId, personsLifecycleAdapter);

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
				name: input.name,
				orcid: input.orcid,
				sortName: input.sortName,
			})
			.where(eq(schema.persons.id, draftVersionId));

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
