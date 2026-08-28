"use server";

import * as schema from "@dariah-eric/database/schema";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { forbidden } from "next/navigation";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAuthenticated } from "@/lib/auth/session";
import {
	countryReportRevalidatePaths,
	getCountryReportEditHrefById,
} from "@/lib/data/reporting-urls";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { redirect } from "@/lib/navigation/navigation";

export async function confirmCountryReportAction(formData: FormData): Promise<void> {
	const id = formData.get("id");
	if (typeof id !== "string") {
		return;
	}

	const locale = await getLocale();
	const { user } = await assertAuthenticated();
	// Accepting a submitted report is admin-only.
	if (user.role !== "admin") {
		forbidden();
	}

	const report = await db.query.countryReports.findFirst({
		where: { id },
		columns: { status: true },
	});
	// Only a submitted report can be accepted.
	if (report?.status !== "submitted") {
		return;
	}

	await db
		.update(schema.countryReports)
		.set({ status: "accepted" })
		.where(eq(schema.countryReports.id, id));

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "update",
		subjectType: "country_report",
		subjectId: id,
		summary: {
			...getAuditSummaryFromFormData(formData),
			status: "accepted",
		},
	});

	for (const path of countryReportRevalidatePaths) {
		revalidatePath(path, "layout");
	}

	redirect({ href: await getCountryReportEditHrefById(id, "confirm"), locale });
}
