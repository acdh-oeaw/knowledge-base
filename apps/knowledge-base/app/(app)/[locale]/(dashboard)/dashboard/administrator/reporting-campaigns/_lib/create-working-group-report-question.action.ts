"use server";

import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";
import { getExtracted } from "next-intl/server";
import * as v from "valibot";

import { createMutationAction } from "@/lib/server/create-mutation-action";

const CreateWorkingGroupReportQuestionSchema = v.object({
	campaignId: v.pipe(v.string(), v.uuid()),
	question: v.pipe(
		v.string(),
		v.nonEmpty(),
		v.rawTransform(({ dataset, addIssue, NEVER }) => {
			try {
				return JSON.parse(dataset.value) as JSONContent;
			} catch {
				addIssue({ message: "Invalid question content." });
				return NEVER;
			}
		}),
	),
});

export const createWorkingGroupReportQuestionAction = createMutationAction({
	schema: CreateWorkingGroupReportQuestionSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "reporting_campaigns" },
	revalidate: "/[locale]/dashboard/administrator/reporting-campaigns",

	async mutate(tx, input) {
		const t = await getExtracted();

		const existing = await tx.query.workingGroupReportQuestions.findMany({
			where: { campaignId: input.campaignId },
			columns: { position: true },
			orderBy: { position: "desc" },
		});
		const nextPosition = existing.length > 0 ? existing[0]!.position + 1 : 1;

		await tx.insert(schema.workingGroupReportQuestions).values({
			campaignId: input.campaignId,
			question: input.question,
			position: nextPosition,
		});

		return { subjectId: input.campaignId, successMessage: t("Added.") };
	},
});
