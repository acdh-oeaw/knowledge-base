"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateEricActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_lib/update-eric.schema";
import { ensureDraftVersion, publishVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { syncEntityRelations } from "@/lib/data/relations";
import { eq, inArray } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateEricAction = createMutationAction({
	schema: UpdateEricActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "eric" },
	revalidate: "/[locale]/dashboard/administrator/eric",
	redirect: "/dashboard/administrator/eric",

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(
			tx,
			input.documentId,
			organisationalUnitsLifecycleAdapter,
		);

		let imageId: string | null = null;
		if (input.imageKey != null) {
			const asset = await tx.query.assets.findFirst({
				where: { key: input.imageKey },
				columns: { id: true },
			});
			assert(asset);
			imageId = asset.id;
		}

		await tx
			.update(schema.organisationalUnits)
			.set({
				acronym: input.acronym,
				imageId,
				name: input.name,
				ror: input.ror,
				sshocMarketplaceActorId: input.sshocMarketplaceActorId,
				summary: input.summary,
			})
			.where(eq(schema.organisationalUnits.id, draftVersionId));

		await replaceEntityVersionFieldContentBlocks(
			tx,
			draftVersionId,
			"description",
			input.descriptionContentBlocks,
		);

		const existingSocialMedia = await tx.query.organisationalUnitsToSocialMedia.findMany({
			where: { organisationalUnitId: draftVersionId },
			columns: { id: true, socialMediaId: true },
		});
		const existingSocialMediaIds = new Set(existingSocialMedia.map((row) => row.socialMediaId));
		const submittedSocialMediaIds = new Set(input.socialMediaIds);

		const socialMediaToDelete = existingSocialMedia
			.filter((row) => !submittedSocialMediaIds.has(row.socialMediaId))
			.map((row) => row.id);

		if (socialMediaToDelete.length > 0) {
			await tx
				.delete(schema.organisationalUnitsToSocialMedia)
				.where(inArray(schema.organisationalUnitsToSocialMedia.id, socialMediaToDelete));
		}

		const socialMediaToInsert = input.socialMediaIds.filter(
			(socialMediaId) => !existingSocialMediaIds.has(socialMediaId),
		);

		if (socialMediaToInsert.length > 0) {
			await tx.insert(schema.organisationalUnitsToSocialMedia).values(
				socialMediaToInsert.map((socialMediaId) => {
					return { organisationalUnitId: draftVersionId, socialMediaId };
				}),
			);
		}

		await syncEntityRelations(
			tx,
			input.documentId,
			input.relatedEntityIds,
			input.relatedResourceIds,
		);
		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, organisationalUnitsLifecycleAdapter);
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
		await dispatchWebhook({ type: "members-partners" });
	},
});
