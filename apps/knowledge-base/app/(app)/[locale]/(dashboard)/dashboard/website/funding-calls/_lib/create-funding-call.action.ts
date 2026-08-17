"use server";

import { assert, keyBy } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import slugify from "@sindresorhus/slugify";

import { CreateFundingCallActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/website/funding-calls/_lib/create-funding-call.schema";
import { upsertTypedContentBlock } from "@/lib/content-blocks-service";
import { createDraftDocument, publishVersion } from "@/lib/data/entity-lifecycle";
import { fundingCallsLifecycleAdapter } from "@/lib/data/funding-calls.lifecycle-adapter";
import { db } from "@/lib/db";
import { shouldSaveAndPublish } from "@/lib/form-intent";
import { syncWebsiteDocumentForEntity } from "@/lib/search/website-index";
import { createMutationAction } from "@/lib/server/create-mutation-action";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export const createFundingCallAction = createMutationAction({
	schema: CreateFundingCallActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "funding_calls" },
	revalidate: "/[locale]/dashboard/website/funding-calls",
	redirect: "/dashboard/website/funding-calls",

	async mutate(tx, input, { formData }) {
		const slug = slugify(input.title);

		const type = await tx.query.entityTypes.findFirst({
			where: { type: "funding_calls" },
			columns: { id: true },
		});
		assert(type);

		const { documentId, versionId } = await createDraftDocument(tx, type.id, slug);

		await tx.insert(schema.fundingCalls).values({
			id: versionId,
			duration: input.duration,
			title: input.title,
			summary: input.summary,
		});

		const contentFieldName = await tx.query.entityTypesFieldsNames.findFirst({
			where: { entityTypeId: type.id, fieldName: "content" },
			columns: { id: true },
		});
		assert(contentFieldName);

		const [contentField] = await tx
			.insert(schema.fields)
			.values({ entityVersionId: versionId, fieldNameId: contentFieldName.id })
			.returning({ id: schema.fields.id });
		assert(contentField);

		const contentBlockTypes = await db.query.contentBlockTypes.findMany();
		const contentBlockTypesByType = keyBy(contentBlockTypes, (item) => item.type);

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

		if (shouldSaveAndPublish(formData)) {
			await publishVersion(tx, documentId, fundingCallsLifecycleAdapter);
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
		await dispatchWebhook({ type: "funding-calls" });
	},
});
