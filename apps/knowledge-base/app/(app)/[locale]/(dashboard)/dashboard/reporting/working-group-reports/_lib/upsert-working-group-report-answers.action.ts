"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import type { JSONContent } from "@tiptap/core";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import * as v from "valibot";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import {
	getWorkingGroupReportEditHrefById,
	sanitizeReportRedirectTo,
	workingGroupReportRevalidatePaths,
} from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { redirect } from "@/lib/navigation/navigation";

const UpsertWorkingGroupReportAnswersSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	answers: v.optional(v.record(v.string(), v.string())),
});

export async function upsertWorkingGroupReportAnswersAction(formData: FormData): Promise<void> {
	if (!(await globalPostRequestRateLimit())) {
		return;
	}

	const result = v.safeParse(UpsertWorkingGroupReportAnswersSchema, getFormDataValues(formData));
	if (!result.success) {
		return;
	}

	const { id: reportId, answers } = result.output;

	const locale = await getLocale();
	const { user } = await assertAuthenticated();
	await assertCan(user, "update", { type: "working_group_report", id: reportId });

	await db.transaction(async (tx) => {
		for (const [questionId, answerJson] of Object.entries(answers ?? {})) {
			let answer: JSONContent;
			try {
				answer = JSON.parse(answerJson) as JSONContent;
			} catch {
				continue;
			}

			const existing = await tx.query.workingGroupReportAnswers.findFirst({
				where: { workingGroupReportId: reportId, questionId },
				columns: { id: true },
			});

			if (existing != null) {
				await tx
					.update(schema.workingGroupReportAnswers)
					.set({ answer })
					.where(eq(schema.workingGroupReportAnswers.id, existing.id));
			} else {
				await tx
					.insert(schema.workingGroupReportAnswers)
					.values({ workingGroupReportId: reportId, questionId, answer });
			}
		}
	});

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "update",
		subjectType: "working_group_report",
		subjectId: reportId,
		summary: getAuditSummaryFromFormData(formData),
	});

	for (const path of workingGroupReportRevalidatePaths) {
		revalidatePath(path, "layout");
	}

	const redirectTo = sanitizeReportRedirectTo(formData.get("redirectTo"));
	redirect({
		href: redirectTo ?? (await getWorkingGroupReportEditHrefById(reportId, "questions")),
		locale,
	});
}
