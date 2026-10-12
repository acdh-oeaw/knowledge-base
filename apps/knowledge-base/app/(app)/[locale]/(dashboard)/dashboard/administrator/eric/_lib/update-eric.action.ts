"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateEricActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/eric/_lib/update-eric.schema";
import {
	ensureLocalizedDraftVersion,
	getDocumentSlug,
	publishVersion,
	touchVersion,
} from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { getLocaleSearch } from "@/lib/data/locales";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { syncEntityRelations } from "@/lib/data/relations";
import { syncOrganisationalUnitSocialMedia } from "@/lib/data/social-media-relations";
import { checkSshocMarketplaceActorIdAvailable } from "@/lib/data/sshoc-marketplace-actor-id";
import { eq } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateEricAction = createMutationAction<
	typeof UpdateEricActionInputSchema,
	{ localeSearch: string }
>({
	schema: UpdateEricActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "eric" },
	revalidate: "/[locale]/dashboard/administrator/eric",
	redirect: ({ result }) =>
		`/dashboard/administrator/eric/${getResultSlug(result)}/details${result.successData?.localeSearch ?? ""}`,

	async preCheck({ input }) {
		return checkSshocMarketplaceActorIdAvailable({
			sshocMarketplaceActorId: input.sshocMarketplaceActorId,
			excludeDocumentId: input.documentId,
		});
	},

	async mutate(tx, input, { formData }) {
		const { versionId: draftVersionId } = await ensureLocalizedDraftVersion(
			tx,
			input.documentId,
			organisationalUnitsLifecycleAdapter,
			input.localeId,
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

		await syncOrganisationalUnitSocialMedia(tx, draftVersionId, input.socialMediaIds);

		await syncEntityRelations(
			tx,
			input.documentId,
			input.relatedEntityIds,
			input.relatedResourceIds,
		);
		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(
				tx,
				input.documentId,
				organisationalUnitsLifecycleAdapter,
				input.localeId,
			);
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
		await dispatchWebhook({ type: "members-partners" });
	},
});
