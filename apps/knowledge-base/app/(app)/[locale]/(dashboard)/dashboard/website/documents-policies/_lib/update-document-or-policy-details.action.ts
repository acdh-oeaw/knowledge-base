"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateDocumentOrPolicyDetailsActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/update-document-or-policy-details.schema";
import { getDocumentIdForVersion, getDocumentVersions } from "@/lib/data/entity-lifecycle";
import { eq, isNull } from "@/lib/db/sql";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateDocumentOrPolicyDetailsAction = createMutationAction<
	typeof UpdateDocumentOrPolicyDetailsActionInputSchema,
	{ entityDocumentId: string; shouldSyncPublishedVersion: boolean }
>({
	schema: UpdateDocumentOrPolicyDetailsActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "documents_policies" },
	revalidate: "/[locale]/dashboard/website/documents-policies",

	async mutate(tx, input) {
		const entityDocumentId = await getDocumentIdForVersion(tx, input.id);
		const { publishedId } = await getDocumentVersions(tx, entityDocumentId);
		const shouldSyncPublishedVersion = publishedId === input.id;

		const asset = await tx.query.assets.findFirst({
			where: { key: input.documentKey },
			columns: { id: true },
		});

		assert(asset);

		const current = await tx.query.documentsPolicies.findFirst({
			where: { id: input.id },
			columns: { groupId: true },
		});

		const newGroupId = input.groupId ?? null;
		let newPosition: number | undefined;

		if (current != null && current.groupId !== newGroupId) {
			const siblings = await tx
				.select({ id: schema.documentsPolicies.id })
				.from(schema.documentsPolicies)
				.where(
					newGroupId != null
						? eq(schema.documentsPolicies.groupId, newGroupId)
						: isNull(schema.documentsPolicies.groupId),
				);

			newPosition = siblings.length;
		}

		await tx
			.update(schema.documentsPolicies)
			.set({
				title: input.title,
				summary: input.summary,
				url: input.url != null && input.url.length > 0 ? input.url : null,
				groupId: newGroupId,
				documentId: asset.id,
				...(newPosition !== undefined ? { position: newPosition } : {}),
			})
			.where(eq(schema.documentsPolicies.id, input.id));

		return {
			subjectId: input.id,
			successData: { entityDocumentId, shouldSyncPublishedVersion },
		};
	},

	async postCommit({ result }) {
		if (result.successData == null || !result.successData.shouldSyncPublishedVersion) {
			return;
		}

		await syncWebsiteDocumentForEntity(result.successData.entityDocumentId);
		await dispatchWebhook({ type: "documents-policies" });
	},
});
