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

export async function deleteCountryReportSocialMediaAction(formData: FormData): Promise<void> {
	if (!(await globalPostRequestRateLimit())) {
		return;
	}

	const membershipId = formData.get("membershipId");
	const countryReportId = formData.get("countryReportId");
	if (typeof membershipId !== "string" || typeof countryReportId !== "string") {
		return;
	}

	const { user } = await assertAuthenticated();
	await assertCan(user, "update", { type: "country_report", id: countryReportId });
	await assertReportEditable(user, { type: "country_report", id: countryReportId });

	await db.transaction(async (tx) => {
		// Scope by both ids so a row can only be removed via the report it belongs to (the authz check is
		// on countryReportId, so matching the membership id alone would allow cross-report deletes).
		const membership = await tx.query.countryReportSocialMedia.findFirst({
			where: { id: membershipId, countryReportId },
			columns: { socialMediaId: true },
		});
		if (membership == null) {
			return;
		}

		// Remove the account's KPI values for this report along with the membership.
		await tx
			.delete(schema.countryReportSocialMediaKpis)
			.where(
				and(
					eq(schema.countryReportSocialMediaKpis.countryReportId, countryReportId),
					eq(schema.countryReportSocialMediaKpis.socialMediaId, membership.socialMediaId),
				),
			);

		await tx
			.delete(schema.countryReportSocialMedia)
			.where(
				and(
					eq(schema.countryReportSocialMedia.id, membershipId),
					eq(schema.countryReportSocialMedia.countryReportId, countryReportId),
				),
			);
	});

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
