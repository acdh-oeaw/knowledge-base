"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateDocumentOrPolicyActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/documents-policies/_lib/update-document-or-policy.schema";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import {
	ensureLocalizedDraftVersion,
	getDocumentSlug,
	publishVersion,
	touchVersion,
	updateDraftDocumentSlug,
} from "@/lib/data/entity-lifecycle";
import {
	deleteFieldContentBlocks,
	ensureEntityVersionField,
	insertContentBlockTree,
} from "@/lib/data/entity-version-fields";
import { getLocaleSearch } from "@/lib/data/locales";
import { eq, isNull } from "@/lib/db/sql";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateDocumentOrPolicyAction = createMutationAction<
	typeof UpdateDocumentOrPolicyActionInputSchema,
	{ published: boolean; localeSearch: string }
>({
	schema: UpdateDocumentOrPolicyActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "documents_policies" },
	revalidate: "/[locale]/dashboard/website/documents-policies",
	redirect: ({ result }) =>
		`/dashboard/website/documents-policies/${getResultSlug(result)}/details${result.successData?.localeSearch ?? ""}`,

	async mutate(tx, input, { formData }) {
		const { versionId: draftVersionId } = await ensureLocalizedDraftVersion(
			tx,
			input.documentId,
			documentsPoliciesLifecycleAdapter,
			input.localeId,
		);

		// The form only offers the slug while the document is draft-only; `updateDraftDocumentSlug`
		// re-checks that server-side, so a forged submission cannot rename a published page.
		const requestedSlug = getRequestedSlug(input.slug);
		if (requestedSlug != null) {
			await updateDraftDocumentSlug(tx, input.documentId, requestedSlug, input.localeId);
		}

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

		await deleteFieldContentBlocks(tx, contentField.id);

		await insertContentBlockTree(tx, contentField.id, input.contentBlocks);

		await touchVersion(tx, draftVersionId);

		const published = shouldSaveAndPublish(formData);
		if (published) {
			await publishVersion(tx, input.documentId, documentsPoliciesLifecycleAdapter, input.localeId);
		}

		return {
			subjectId: input.documentId,
			subjectSlug: await getDocumentSlug(tx, input.documentId, input.localeId),
			auditSummary: { lifecycle: published ? "published" : "draft" },
			successData: { published, localeSearch: await getLocaleSearch(tx, input.localeId) },
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
