"use server";

import * as schema from "@dariah-eric/database/schema";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { getWorkingGroupReportEditHrefById } from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { redirect } from "@/lib/navigation/navigation";

export async function submitWorkingGroupReportAction(formData: FormData): Promise<void> {
	const id = formData.get("id");
	if (typeof id !== "string") {
		return;
	}

	const locale = await getLocale();
	const { user } = await assertAuthenticated();
	await assertCan(user, "update", { type: "working_group_report", id });

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

	revalidatePath("/[locale]/dashboard/reporting", "layout");

	redirect({ href: await getWorkingGroupReportEditHrefById(id, "confirm"), locale });
}
