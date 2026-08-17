"use server";

import * as schema from "@dariah-eric/database/schema";
import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCountryReportEditHrefById } from "@/lib/data/reporting-urls";
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
	await assertCan(user, "confirm", { type: "country_report", id });

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
			status: "confirmed",
		},
	});

	revalidatePath("/[locale]/dashboard/reporting", "layout");

	redirect({ href: await getCountryReportEditHrefById(id, "confirm"), locale });
}
