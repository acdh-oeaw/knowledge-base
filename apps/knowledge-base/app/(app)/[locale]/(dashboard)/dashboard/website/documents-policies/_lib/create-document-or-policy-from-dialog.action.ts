"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import slugify from "@sindresorhus/slugify";

import { CreateDocumentOrPolicyFromDialogActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/create-document-or-policy-from-dialog.schema";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import { createDraftDocument, publishVersion } from "@/lib/data/entity-lifecycle";
import { ensureEntityVersionField } from "@/lib/data/entity-version-fields";
import { eq, isNull } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createDocumentOrPolicyFromDialogAction = createMutationAction<
	typeof CreateDocumentOrPolicyFromDialogActionInputSchema,
	{ documentId: string; published: boolean }
>({
	schema: CreateDocumentOrPolicyFromDialogActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "documents_policies" },
	revalidate: "/[locale]/dashboard/website/documents-policies",

	async mutate(tx, input, { formData }) {
		const slug = slugify(input.title);

		const type = await tx.query.entityTypes.findFirst({
			where: { type: "documents_policies" },
			columns: { id: true },
		});

		assert(type);

		const { documentId, versionId } = await createDraftDocument(tx, type.id, slug);

		const asset = await tx.query.assets.findFirst({
			where: { key: input.documentKey },
			columns: { id: true },
		});

		assert(asset);

		const siblings = await tx
			.select({ id: schema.documentsPolicies.id })
			.from(schema.documentsPolicies)
			.where(
				input.groupId != null
					? eq(schema.documentsPolicies.groupId, input.groupId)
					: isNull(schema.documentsPolicies.groupId),
			);

		await tx.insert(schema.documentsPolicies).values({
			id: versionId,
			documentId: asset.id,
			title: input.title,
			summary: input.summary,
			url: input.url != null && input.url.length > 0 ? input.url : null,
			groupId: input.groupId ?? null,
			position: siblings.length,
		});

		await ensureEntityVersionField(tx, versionId, "description");

		const published = shouldSaveAndPublish(formData);
		if (published) {
			await publishVersion(tx, documentId, documentsPoliciesLifecycleAdapter);
		}

		return {
			subjectId: documentId,
			auditSummary: { lifecycle: published ? "published" : "draft" },
			successData: { documentId, published },
		};
	},

	async postCommit({ result }) {
		if (result.successData == null || !result.successData.published) {
			return;
		}

		await syncWebsiteDocumentForEntity(result.successData.documentId);
		await dispatchWebhook({ type: "documents-policies" });
	},
});
