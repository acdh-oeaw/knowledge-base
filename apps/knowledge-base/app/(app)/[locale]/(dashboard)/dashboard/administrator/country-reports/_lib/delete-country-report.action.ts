"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { db } from "@/lib/db";
import { and, eq } from "@/lib/db/sql";

export async function deleteCountryReportAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();

	// Snapshot the label while the report still exists, so the audit log doesn't fall back to the uuid.
	const subjectLabel = await resolveAuditSubjectLabel("country_reports", id);

	await db.transaction(async (tx) => {
		await tx
			.delete(schema.reportScreenComments)
			.where(
				and(
					eq(schema.reportScreenComments.reportType, "country"),
					eq(schema.reportScreenComments.reportId, id),
				),
			);
		await tx
			.delete(schema.countryReportContributions)
			.where(eq(schema.countryReportContributions.countryReportId, id));
		await tx
			.delete(schema.countryReportSocialMediaKpis)
			.where(eq(schema.countryReportSocialMediaKpis.countryReportId, id));
		await tx
			.delete(schema.countryReportSocialMedia)
			.where(eq(schema.countryReportSocialMedia.countryReportId, id));
		await tx
			.delete(schema.countryReportServiceKpis)
			.where(eq(schema.countryReportServiceKpis.countryReportId, id));
		await tx
			.delete(schema.countryReportServices)
			.where(eq(schema.countryReportServices.countryReportId, id));
		await tx
			.delete(schema.countryReportProjectContributions)
			.where(eq(schema.countryReportProjectContributions.countryReportId, id));
		await tx
			.delete(schema.countryReportInstitutions)
			.where(eq(schema.countryReportInstitutions.countryReportId, id));
		await tx.delete(schema.countryReports).where(eq(schema.countryReports.id, id));
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "country_reports",
		subjectId: id,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator/country-reports", "layout");
}
