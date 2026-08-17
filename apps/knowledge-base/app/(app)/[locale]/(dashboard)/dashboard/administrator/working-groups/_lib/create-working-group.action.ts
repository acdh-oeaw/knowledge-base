"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import slugify from "@sindresorhus/slugify";

import { CreateWorkingGroupActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/working-groups/_lib/create-working-group.schema";
import { createDraftDocument, publishVersion } from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { organisationalUnitsLifecycleAdapter } from "@/lib/data/organisational-units.lifecycle-adapter";
import { filterToPublishedDocumentIds } from "@/lib/data/relations";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createWorkingGroupAction = createMutationAction({
	schema: CreateWorkingGroupActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "working_groups" },
	revalidate: "/[locale]/dashboard/administrator/working-groups",
	redirect: "/dashboard/administrator/working-groups",

	async mutate(tx, input, { formData }) {
		const slug = slugify(input.name);

		const entityType = await tx.query.entityTypes.findFirst({
			where: { type: "organisational_units" },
			columns: { id: true },
		});
		assert(entityType);

		const orgUnitType = await tx.query.organisationalUnitTypes.findFirst({
			where: { type: "working_group" },
			columns: { id: true },
		});
		assert(orgUnitType);

		const { documentId, versionId } = await createDraftDocument(tx, entityType.id, slug);

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
				publishedRelatedEntityIds.map((relatedEntityId) => {
					return { entityId: documentId, relatedEntityId };
				}),
			);
		}

		if (input.relatedResourceIds.length > 0) {
			await tx.insert(schema.entitiesToResources).values(
				input.relatedResourceIds.map((resourceId) => {
					return { entityId: documentId, resourceId };
				}),
			);
		}

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
			auditSummary: {
				lifecycle: shouldSaveAndPublish(formData) ? "published" : "draft",
			},
		};
	},

	async postCommit({ ctx }) {
		if (!shouldSaveAndPublish(ctx.formData)) {
			return;
		}
		await dispatchWebhook({ type: "working-groups" });
	},
});
