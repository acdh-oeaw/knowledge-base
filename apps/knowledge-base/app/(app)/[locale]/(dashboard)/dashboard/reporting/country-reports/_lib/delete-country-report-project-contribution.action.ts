"use server";

import * as schema from "@dariah-eric/database/schema";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { revalidatePath } from "next/cache";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan, assertReportEditable } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { countryReportRevalidatePaths } from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { and, eq } from "@/lib/db/sql";

export async function deleteCountryReportProjectContributionAction(
	formData: FormData,
): Promise<void> {
	if (!(await globalPostRequestRateLimit())) {
		return;
	}

	const contributionId = formData.get("contributionId");
	const countryReportId = formData.get("countryReportId");
	if (typeof contributionId !== "string" || typeof countryReportId !== "string") {
		return;
	}

	const { user } = await assertAuthenticated();
	await assertCan(user, "update", { type: "country_report", id: countryReportId });
	await assertReportEditable(user, { type: "country_report", id: countryReportId });

	// Scope by both ids so a row can only be removed via the report it belongs to (the authz check is on
	// countryReportId, so matching the contribution id alone would allow cross-report deletes).
	await db
		.delete(schema.countryReportProjectContributions)
		.where(
			and(
				eq(schema.countryReportProjectContributions.id, contributionId),
				eq(schema.countryReportProjectContributions.countryReportId, countryReportId),
			),
		);

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "delete",
		subjectType: "country_report",
		subjectId: countryReportId,
		summary: getAuditSummaryFromFormData(formData),
	});

	for (const path of countryReportRevalidatePaths) {
		revalidatePath(path, "layout");
	}
}
