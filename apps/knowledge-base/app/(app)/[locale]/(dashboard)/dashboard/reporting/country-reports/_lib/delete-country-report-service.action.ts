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

export async function deleteCountryReportServiceAction(formData: FormData): Promise<void> {
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
		const membership = await tx.query.countryReportServices.findFirst({
			where: { id: membershipId, countryReportId },
			columns: { serviceId: true },
		});
		if (membership == null) {
			return;
		}

		await tx
			.delete(schema.countryReportServiceKpis)
			.where(
				and(
					eq(schema.countryReportServiceKpis.countryReportId, countryReportId),
					eq(schema.countryReportServiceKpis.serviceId, membership.serviceId),
				),
			);

		await tx
			.delete(schema.countryReportServices)
			.where(
				and(
					eq(schema.countryReportServices.id, membershipId),
					eq(schema.countryReportServices.countryReportId, countryReportId),
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
