"use server";

import { assert, keyBy } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateDocumentOrPolicyActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/update-document-or-policy.schema";
import { upsertTypedContentBlock } from "@/lib/content-blocks-service";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import { ensureDraftVersion, publishVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { ensureEntityVersionField } from "@/lib/data/entity-version-fields";
import { db } from "@/lib/db";
import { eq, inArray, isNull } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateDocumentOrPolicyAction = createMutationAction<
	typeof UpdateDocumentOrPolicyActionInputSchema,
	{ published: boolean }
>({
	schema: UpdateDocumentOrPolicyActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "documents_policies" },
	revalidate: "/[locale]/dashboard/website/documents-policies",
	redirect: "/dashboard/website/documents-policies",

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(
			tx,
			input.documentId,
			documentsPoliciesLifecycleAdapter,
		);

		const asset = await tx.query.assets.findFirst({
			where: { key: input.documentKey },
			columns: { id: true },
		});

		assert(asset);

		const current = await tx.query.documentsPolicies.findFirst({
			where: { id: draftVersionId },
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
				documentId: asset.id,
				title: input.title,
				summary: input.summary,
				url: input.url != null && input.url.length > 0 ? input.url : null,
				groupId: newGroupId,
				...(newPosition !== undefined ? { position: newPosition } : {}),
			})
			.where(eq(schema.documentsPolicies.id, draftVersionId));

		const contentField = await ensureEntityVersionField(tx, draftVersionId, "description");

		const contentBlockTypes = await db.query.contentBlockTypes.findMany();
		const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

		const existingBlocks = await tx.query.contentBlocks.findMany({
			where: { fieldId: contentField.id },
			columns: { id: true },
		});

		if (existingBlocks.length > 0) {
			await tx.delete(schema.contentBlocks).where(
				inArray(
					schema.contentBlocks.id,
					existingBlocks.map((b) => b.id),
				),
			);
		}

		await Promise.all(
			input.contentBlocks.map(async (contentBlock, index) => {
				const [added] = await tx
					.insert(schema.contentBlocks)
					.values({
						fieldId: contentField.id,
						typeId: contentBlockTypesByType[contentBlock.type].id,
						position: index,
					})
					.returning({ id: schema.contentBlocks.id });

				assert(added);

				await upsertTypedContentBlock(tx, contentBlock, added.id, true);
			}),
		);

		await touchVersion(tx, draftVersionId);

		const published = shouldSaveAndPublish(formData);
		if (published) {
			await publishVersion(tx, input.documentId, documentsPoliciesLifecycleAdapter);
		}

		return {
			subjectId: input.documentId,
			auditSummary: { lifecycle: published ? "published" : "draft" },
			successData: { published },
		};
	},

	async postCommit({ result, input }) {
		if (result.successData == null || !result.successData.published) {
			return;
		}

		await syncWebsiteDocumentForEntity(input.documentId);
		await dispatchWebhook({ type: "documents-policies" });
	},
});
