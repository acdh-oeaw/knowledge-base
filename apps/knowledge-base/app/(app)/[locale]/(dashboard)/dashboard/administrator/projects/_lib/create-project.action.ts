"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import slugify from "@sindresorhus/slugify";

import { CreateProjectActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/projects/_lib/create-project.schema";
import { createDraftDocument, publishVersion } from "@/lib/data/entity-lifecycle";
import { replaceEntityVersionFieldContentBlocks } from "@/lib/data/entity-version-fields";
import { projectsLifecycleAdapter } from "@/lib/data/projects.lifecycle-adapter";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createProjectAction = createMutationAction({
	schema: CreateProjectActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "projects" },
	revalidate: "/[locale]/dashboard/administrator/projects",
	redirect: "/dashboard/administrator/projects",

	async mutate(tx, input, { formData }) {
		const slug = slugify(input.name);

		const type = await tx.query.entityTypes.findFirst({
			where: { type: "projects" },
			columns: { id: true },
		});
		assert(type);

		const { documentId, versionId } = await createDraftDocument(tx, type.id, slug);

		let imageId: string | null = null;
		if (input.imageKey != null) {
			const asset = await tx.query.assets.findFirst({
				where: { key: input.imageKey },
				columns: { id: true },
			});
			assert(asset);
			imageId = asset.id;
		}

		await tx.insert(schema.projects).values({
			id: versionId,
			acronym: input.acronym,
			call: input.call,
			duration: input.duration,
			funding: input.funding,
			imageId,
			name: input.name,
			scopeId: input.scopeId,
			summary: input.summary,
			topic: input.topic,
		});

		await replaceEntityVersionFieldContentBlocks(
			tx,
			versionId,
			"description",
			input.descriptionContentBlocks,
		);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, documentId, projectsLifecycleAdapter);
		}

		return {
			subjectId: documentId,
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
