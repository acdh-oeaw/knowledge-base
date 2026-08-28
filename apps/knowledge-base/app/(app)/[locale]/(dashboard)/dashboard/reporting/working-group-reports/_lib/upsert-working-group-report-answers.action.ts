"use server";

import { assert } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import type { JSONContent } from "@tiptap/core";
import { getExtracted } from "next-intl/server";
import * as v from "valibot";

import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { workingGroupReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { sql } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

const UpsertWorkingGroupReportAnswersSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	answers: v.optional(v.record(v.string(), v.string())),
});

export const upsertWorkingGroupReportAnswersAction = createMutationAction({
	schema: UpsertWorkingGroupReportAnswersSchema,
	requireAuth: true,
	audit: { action: "update", subjectType: "working_group_report" },
	revalidate: workingGroupReportRevalidatePaths,

	async preCheck({ input, ctx }) {
		await assertCan(ctx.user, "update", { type: "working_group_report", id: input.id });
		await assertReportEditable(ctx.user, { type: "working_group_report", id: input.id });
		return undefined;
	},

	async mutate(tx, input) {
		const t = await getExtracted();

		// Only accept answers to questions that belong to this report's campaign, so a forged questionId
		// can't store a stray answer row (e.g. referencing another campaign's question).
		const report = await tx.query.workingGroupReports.findFirst({
			where: { id: input.id },
			columns: { campaignId: true },
		});
		assert(report, "Working group report not found.");

		const campaignQuestions = await tx.query.workingGroupReportQuestions.findMany({
			where: { campaignId: report.campaignId },
			columns: { id: true },
		});
		const allowedQuestionIds = new Set(campaignQuestions.map((question) => question.id));

		const rows = Object.entries(input.answers ?? {}).flatMap(([questionId, answerJson]) => {
			if (!allowedQuestionIds.has(questionId)) {
				return [];
			}
			let answer: JSONContent;
			try {
				answer = JSON.parse(answerJson) as JSONContent;
			} catch {
				return [];
			}
			return [{ workingGroupReportId: input.id, questionId, answer }];
		});

		if (rows.length > 0) {
			// Single batched upsert keyed by the (report, question) unique constraint; `excluded` is the
			// incoming row, so each conflicting answer is replaced with its submitted value.
			await tx
				.insert(schema.workingGroupReportAnswers)
				.values(rows)
				.onConflictDoUpdate({
					target: [
						schema.workingGroupReportAnswers.workingGroupReportId,
						schema.workingGroupReportAnswers.questionId,
					],
					set: { answer: sql`excluded.answer` },
				});
		}

		return { subjectId: input.id, successMessage: t("Saved.") };
	},
});
