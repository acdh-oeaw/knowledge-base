"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";

import { getDocumentVersions } from "@/lib/data/entity-lifecycle";
import { fundingCallsLifecycleAdapter } from "@/lib/data/funding-calls.lifecycle-adapter";
import { eq, inArray, or } from "@/lib/db/sql";
import {
	deleteWebsiteDocument,
	getWebsiteDocumentDescriptorByEntityId,
} from "@/lib/search/website-index";
import { createCommandAction } from "@/lib/server/create-command-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const deleteFundingCallAction = createCommandAction({
	requireAdmin: true,
	audit: { action: "delete", subjectType: "funding_calls" },
	revalidate: "/[locale]/dashboard/website/funding-calls",

	async mutate(tx, [documentId]: [string]) {
		const entity = await tx.query.entities.findFirst({
			where: { id: documentId },
			columns: { id: true },
		});
		assert(entity, "Document not found.");

		const descriptor = await getWebsiteDocumentDescriptorByEntityId(documentId);

		const { draftId, publishedId } = await getDocumentVersions(tx, documentId);
		const versionIds = [draftId, publishedId].filter((id): id is string => id != null);

		for (const versionId of versionIds) {
			await fundingCallsLifecycleAdapter.wipeSubtype(tx, versionId);
		}

		for (const versionId of versionIds) {
			const fieldRows = await tx
				.select({ id: schema.fields.id })
				.from(schema.fields)
				.where(eq(schema.fields.entityVersionId, versionId));

			if (fieldRows.length > 0) {
				const fieldIds = fieldRows.map((f) => f.id);
				await tx
					.delete(schema.contentBlocks)
					.where(inArray(schema.contentBlocks.fieldId, fieldIds));
				await tx.delete(schema.fields).where(inArray(schema.fields.id, fieldIds));
			}
		}

		await tx
			.delete(schema.entitiesToResources)
			.where(eq(schema.entitiesToResources.entityId, documentId));

		await tx
			.delete(schema.entitiesToEntities)
			.where(
				or(
					eq(schema.entitiesToEntities.entityId, documentId),
					eq(schema.entitiesToEntities.relatedEntityId, documentId),
				),
			);

		if (versionIds.length > 0) {
			await tx.delete(schema.entityVersions).where(inArray(schema.entityVersions.id, versionIds));
		}

		await tx.delete(schema.entities).where(eq(schema.entities.id, documentId));

		return {
			subjectId: documentId,
			descriptor,
		};
	},

	async postCommit({ result }) {
		if (result.descriptor != null) {
			await deleteWebsiteDocument(result.descriptor);
		}
		await dispatchWebhook({ type: "funding-calls" });
	},
});
