"use server";

import * as schema from "@dariah-eric/database/schema";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { revalidatePath } from "next/cache";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { workingGroupReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function deleteWorkingGroupReportEventAction(formData: FormData): Promise<void> {
	if (!(await globalPostRequestRateLimit())) {
		return;
	}

	const eventId = formData.get("eventId");
	const workingGroupReportId = formData.get("workingGroupReportId");
	if (typeof eventId !== "string" || typeof workingGroupReportId !== "string") {
		return;
	}

	const { user } = await assertAuthenticated();
	await assertCan(user, "update", { type: "working_group_report", id: workingGroupReportId });

	await db
		.delete(schema.workingGroupReportEvents)
		.where(eq(schema.workingGroupReportEvents.id, eventId));

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
