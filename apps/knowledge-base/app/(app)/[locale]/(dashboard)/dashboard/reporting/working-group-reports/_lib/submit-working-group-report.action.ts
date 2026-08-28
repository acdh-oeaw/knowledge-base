"use server";

import * as schema from "@dariah-eric/database/schema";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import {
	getWorkingGroupReportEditHrefById,
	workingGroupReportRevalidatePaths,
} from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { sendReportSubmittedNotification } from "@/lib/email/send-report-submitted-notification";
import { redirect } from "@/lib/navigation/navigation";

export async function submitWorkingGroupReportAction(formData: FormData): Promise<void> {
	const id = formData.get("id");
	if (typeof id !== "string") {
		return;
	}

	const locale = await getLocale();
	const { user } = await assertAuthenticated();
	// Submitting is reserved for the confirm role (WG chairs / admins), not plain reporters.
	await assertCan(user, "confirm", { type: "working_group_report", id });

	const report = await db.query.workingGroupReports.findFirst({
		where: { id },
		columns: { status: true },
		with: {
			campaign: { columns: { status: true, year: true } },
			workingGroup: { columns: { name: true } },
		},
	});
	// Only a draft report in an open campaign can be submitted (no re-submit; accepted is terminal).
	if (report?.status !== "draft" || report.campaign.status !== "open") {
		return;
	}

	await db
		.update(schema.workingGroupReports)
		.set({ status: "submitted" })
		.where(eq(schema.workingGroupReports.id, id));

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "update",
		subjectType: "working_group_report",
		subjectId: id,
		summary: {
			...getAuditSummaryFromFormData(formData),
			status: "submitted",
		},
	});

	const editHref = await getWorkingGroupReportEditHrefById(id, "confirm");

	// Best-effort notification; deferred so a slow/failing mail server can not delay or block the
	// submission, whose outcome does not depend on the email being delivered.
	after(async () => {
		await sendReportSubmittedNotification({
			type: "working_group_report",
			name: report.workingGroup?.name ?? null,
			year: report.campaign.year,
			href: editHref,
			locale,
			submittedBy: { name: user.name, email: user.email },
		});
	});

	for (const path of workingGroupReportRevalidatePaths) {
		revalidatePath(path, "layout");
	}

	redirect({ href: editHref, locale });
}
