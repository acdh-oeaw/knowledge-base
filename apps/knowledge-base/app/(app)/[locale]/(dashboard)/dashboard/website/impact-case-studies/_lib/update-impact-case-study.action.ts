"use server";

import { assert, keyBy } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";

import { UpdateImpactCaseStudyActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/impact-case-studies/_lib/update-impact-case-study.schema";
import { upsertTypedContentBlock } from "@/lib/content-blocks-service";
import { ensureDraftVersion, publishVersion, touchVersion } from "@/lib/data/entity-lifecycle";
import { ensureEntityVersionField } from "@/lib/data/entity-version-fields";
import { impactCaseStudiesLifecycleAdapter } from "@/lib/data/impact-case-studies.lifecycle-adapter";
import { syncEntityRelations } from "@/lib/data/relations";
import { db } from "@/lib/db";
import { eq, inArray } from "@/lib/db/sql";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const updateImpactCaseStudyAction = createMutationAction({
	schema: UpdateImpactCaseStudyActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "impact_case_studies" },
	revalidate: "/[locale]/dashboard/website/impact-case-studies",
	redirect: "/dashboard/website/impact-case-studies",

	async mutate(tx, input, { formData }) {
		const draftVersionId = await ensureDraftVersion(
			tx,
			input.documentId,
			impactCaseStudiesLifecycleAdapter,
		);

		const asset = await tx.query.assets.findFirst({
			where: { key: input.imageKey },
			columns: { id: true },
		});
		assert(asset);

		await tx
			.update(schema.impactCaseStudies)
			.set({ imageId: asset.id, title: input.title, summary: input.summary })
			.where(eq(schema.impactCaseStudies.id, draftVersionId));

		const contentField = await ensureEntityVersionField(tx, draftVersionId, "content");
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

		await syncEntityRelations(
			tx,
			input.documentId,
			input.relatedEntityIds,
			input.relatedResourceIds,
		);
		await touchVersion(tx, draftVersionId);

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, input.documentId, impactCaseStudiesLifecycleAdapter);
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
		await dispatchWebhook({ type: "impact-case-studies" });
	},
});
