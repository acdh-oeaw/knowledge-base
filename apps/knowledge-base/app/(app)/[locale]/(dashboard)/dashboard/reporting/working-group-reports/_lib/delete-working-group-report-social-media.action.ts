"use server";

import * as schema from "@dariah-eric/database/schema";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { revalidatePath } from "next/cache";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { workingGroupReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { and, eq } from "@/lib/db/sql";

export async function deleteWorkingGroupReportSocialMediaAction(formData: FormData): Promise<void> {
	if (!(await globalPostRequestRateLimit())) {
		return;
	}

	const claimedId = formData.get("claimedId");
	const workingGroupReportId = formData.get("workingGroupReportId");
	if (typeof claimedId !== "string" || typeof workingGroupReportId !== "string") {
		return;
	}

	const { user } = await assertAuthenticated();
	await assertCan(user, "update", { type: "working_group_report", id: workingGroupReportId });
	await assertReportEditable(user, { type: "working_group_report", id: workingGroupReportId });

	// Scope by both ids so a row can only be removed via the report it belongs to (the authz check is on
	// workingGroupReportId, so matching the claimed id alone would allow cross-report deletes).
	await db
		.delete(schema.workingGroupReportSocialMedia)
		.where(
			and(
				eq(schema.workingGroupReportSocialMedia.id, claimedId),
				eq(schema.workingGroupReportSocialMedia.workingGroupReportId, workingGroupReportId),
			),
		);

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "delete",
		subjectType: "working_group_report",
		subjectId: workingGroupReportId,
		summary: getAuditSummaryFromFormData(formData),
	});

	for (const path of workingGroupReportRevalidatePaths) {
		revalidatePath(path, "layout");
	}
}
