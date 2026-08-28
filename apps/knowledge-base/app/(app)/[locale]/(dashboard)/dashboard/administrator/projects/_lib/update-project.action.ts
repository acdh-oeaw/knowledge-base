"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateProjectActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/update-project.schema";
import {
	ensureDraftVersion,
	getDocumentSlug,
	publishVersion,
	touchVersion,
	updateDraftDocumentSlug,
} from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { syncEntityRelations } from "@/lib/data/relations";
import { syncProjectSocialMedia } from "@/lib/data/social-media-relations";
import { eq } from "@/lib/db/sql";
import { getRequestedSlug } from "@/lib/entity-slug-input";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction, getResultSlug } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateProjectAction = createMutationAction({
	schema: UpdateProjectActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "projects" },
	revalidate: "/[locale]/dashboard/administrator/projects",
	redirect: ({ result }) => `/dashboard/administrator/projects/${getResultSlug(result)}/details`,

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(tx, input.documentId, projectsLifecycleAdapter);

		// The form only offers the slug while the document is draft-only; `updateDraftDocumentSlug`
		// re-checks that server-side, so a forged submission cannot rename a published page.
		const requestedSlug = getRequestedSlug(input.slug);
		if (requestedSlug != null) {
			await updateDraftDocumentSlug(tx, input.documentId, requestedSlug);
		}

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
			.update(schema.projects)
			.set({
				acronym: input.acronym,
				call: input.call,
				duration: input.duration,
				funding: input.funding,
				imageId,
				name: input.name,
				scopeId: input.scopeId,
				summary: input.summary,
				topic: input.topic,
			})
			.where(eq(schema.projects.id, draftVersionId));

		await replaceEntityVersionFieldContentBlocks(
			tx,
			draftVersionId,
			"description",
			input.descriptionContentBlocks,
		);

		await syncProjectSocialMedia(tx, draftVersionId, input.socialMediaIds);

		await syncEntityRelations(
			tx,
			input.documentId,
			input.relatedEntityIds,
			input.relatedResourceIds,
		);

		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, projectsLifecycleAdapter);
		}

		return {
			subjectId: input.documentId,
			subjectSlug: await getDocumentSlug(tx, input.documentId),
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
		await dispatchWebhook({ type: "dariah-projects" });
	},
});
