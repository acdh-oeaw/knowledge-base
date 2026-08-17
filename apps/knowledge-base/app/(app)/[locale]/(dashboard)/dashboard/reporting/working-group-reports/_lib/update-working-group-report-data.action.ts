"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
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

const UpdateWorkingGroupReportDataSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	numberOfMembers: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0))),
	mailingList: v.optional(v.string()),
});

export async function updateWorkingGroupReportDataAction(formData: FormData): Promise<void> {
	if (!(await globalPostRequestRateLimit())) {
		return;
	}

	const result = v.safeParse(UpdateWorkingGroupReportDataSchema, getFormDataValues(formData));
	if (!result.success) {
		return;
	}

	const { id, numberOfMembers, mailingList } = result.output;

	const locale = await getLocale();
	const { user } = await assertAuthenticated();
	await assertCan(user, "update", { type: "working_group_report", id });

	await db
		.update(schema.workingGroupReports)
		.set({
			numberOfMembers: numberOfMembers ?? null,
			mailingList: mailingList ?? null,
		})
		.where(eq(schema.workingGroupReports.id, id));

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "update",
		subjectType: "working_group_report",
		subjectId: id,
		summary: getAuditSummaryFromFormData(formData),
	});

	for (const path of workingGroupReportRevalidatePaths) {
		revalidatePath(path, "layout");
	}

	const redirectTo = sanitizeReportRedirectTo(formData.get("redirectTo"));
	redirect({ href: redirectTo ?? (await getWorkingGroupReportEditHrefById(id, "data")), locale });
}
