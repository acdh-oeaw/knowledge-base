"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateProjectActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/update-project.schema";
import { ensureDraftVersion, publishVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { eq, inArray } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateProjectAction = createMutationAction({
	schema: UpdateProjectActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "projects" },
	revalidate: "/[locale]/dashboard/administrator/projects",
	redirect: "/dashboard/administrator/projects",

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(tx, input.documentId, projectsLifecycleAdapter);

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

		const existingSocialMedia = await tx.query.projectsToSocialMedia.findMany({
			where: { projectId: draftVersionId },
			columns: { id: true, socialMediaId: true },
		});

		const existingSocialMediaIds = new Set(existingSocialMedia.map((r) => r.socialMediaId));
		const submittedSocialMediaIds = new Set(input.socialMediaIds);

		const socialMediaToDelete = existingSocialMedia
			.filter((r) => !submittedSocialMediaIds.has(r.socialMediaId))
			.map((r) => r.id);

		if (socialMediaToDelete.length > 0) {
			await tx
				.delete(schema.projectsToSocialMedia)
				.where(inArray(schema.projectsToSocialMedia.id, socialMediaToDelete));
		}

		const socialMediaToInsert = input.socialMediaIds.filter(
			(smId) => !existingSocialMediaIds.has(smId),
		);

		if (socialMediaToInsert.length > 0) {
			await tx.insert(schema.projectsToSocialMedia).values(
				socialMediaToInsert.map((socialMediaId) => {
					return { projectId: draftVersionId, socialMediaId };
				}),
			);
		}

		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, projectsLifecycleAdapter);
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
		await dispatchWebhook({ type: "dariah-projects" });
	},
});
