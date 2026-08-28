"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { CreateInstitutionActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/institutions/_lib/create-institution.schema";
import { createDraftDocumentWithSlug, publishVersion } from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { filterToPublishedDocumentIds } from "@/lib/data/relations";
import { syncOrganisationalUnitSocialMedia } from "@/lib/data/social-media-relations";
import { checkSshocMarketplaceActorIdAvailable } from "@/lib/data/sshoc-marketplace-actor-id";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getCreatedSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createInstitutionAction = createMutationAction({
	schema: CreateInstitutionActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "institutions" },
	revalidate: "/[locale]/dashboard/administrator/institutions",
	redirect: ({ result }) =>
		`/dashboard/administrator/institutions/${getCreatedSlug(result)}/details`,

	async preCheck({ input }) {
		return checkSshocMarketplaceActorIdAvailable({
			sshocMarketplaceActorId: input.sshocMarketplaceActorId,
		});
	},

	async mutate(tx, input, { formData }) {
		const entityType = await tx.query.entityTypes.findFirst({
			where: { type: "organisational_units" },
			columns: { id: true },
		});
		assert(entityType);

		const orgUnitType = await tx.query.organisationalUnitTypes.findFirst({
			where: { type: "institution" },
			columns: { id: true },
		});
		assert(orgUnitType);

		const { documentId, versionId, slug } = await createDraftDocumentWithSlug(tx, entityType.id, {
			requestedSlug: getRequestedSlug(input.slug),
			title: input.name,
		});

		let imageId: string | null = null;
		if (input.imageKey != null) {
			const asset = await tx.query.assets.findFirst({
				where: { key: input.imageKey },
				columns: { id: true },
			});
			assert(asset);
			imageId = asset.id;
		}

		await tx.insert(schema.organisationalUnits).values({
			id: versionId,
			acronym: input.acronym,
			ror: input.ror,
			imageId,
			name: input.name,
			sshocMarketplaceActorId: input.sshocMarketplaceActorId,
			summary: input.summary,
			typeId: orgUnitType.id,
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

		await syncOrganisationalUnitSocialMedia(tx, versionId, input.socialMediaIds);

		await replaceEntityVersionFieldContentBlocks(
			tx,
			versionId,
			"description",
			input.descriptionContentBlocks,
		);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, documentId, organisationalUnitsLifecycleAdapter);
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
		await dispatchWebhook({ type: "members-partners" });
	},
});
