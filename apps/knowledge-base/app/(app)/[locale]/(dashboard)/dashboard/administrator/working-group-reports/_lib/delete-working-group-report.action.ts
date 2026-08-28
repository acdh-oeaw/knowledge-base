"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { db } from "@/lib/db";
import { and, eq } from "@/lib/db/sql";

export async function deleteWorkingGroupReportAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();

	// Snapshot the label while the report still exists, so the audit log doesn't fall back to the uuid.
	const subjectLabel = await resolveAuditSubjectLabel("working_group_reports", id);

	await db.transaction(async (tx) => {
		await tx
			.delete(schema.reportScreenComments)
			.where(
				and(
					eq(schema.reportScreenComments.reportType, "working_group"),
					eq(schema.reportScreenComments.reportId, id),
				),
			);
		await tx
			.delete(schema.workingGroupReportAnswers)
			.where(eq(schema.workingGroupReportAnswers.workingGroupReportId, id));
		await tx
			.delete(schema.workingGroupReportEvents)
			.where(eq(schema.workingGroupReportEvents.workingGroupReportId, id));
		await tx
			.delete(schema.workingGroupReportSocialMedia)
			.where(eq(schema.workingGroupReportSocialMedia.workingGroupReportId, id));
		await tx
			.delete(schema.workingGroupReportChairs)
			.where(eq(schema.workingGroupReportChairs.workingGroupReportId, id));
		await tx
			.delete(schema.reportExternalResourceSnapshots)
			.where(eq(schema.reportExternalResourceSnapshots.workingGroupReportId, id));
		await tx.delete(schema.workingGroupReports).where(eq(schema.workingGroupReports.id, id));
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "working_group_reports",
		subjectId: id,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator/working-group-reports", "layout");
}
