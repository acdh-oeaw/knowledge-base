"use server";

import { getFormDataValues } from "@acdh-oeaw/lib";
import * as schema from "@dariah-eric/database/schema";
import { globalPostRequestRateLimit } from "@dariah-eric/next-lib/rate-limiter";
import { getExtracted, getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { getAuditSummaryFromFormData, recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { redirect } from "@/lib/navigation/navigation";

export async function closeReportingCampaignAction(formData: FormData): Promise<void> {
	const locale = await getLocale();
	const t = await getExtracted();

	if (!(await globalPostRequestRateLimit())) {
		throw new Error(t("Too many requests."));
	}

	const auditSession = await assertAdmin();

	const { id } = getFormDataValues(formData) as { id: string };

	const campaign = await db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { status: true },
	});

	if (campaign?.status !== "open") {
		throw new Error(t("Campaign cannot be closed."));
	}

	await db
		.update(schema.reportingCampaigns)
		.set({ status: "closed" })
		.where(eq(schema.reportingCampaigns.id, id));

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "close",
		subjectType: "reporting_campaigns",
		subjectId: id,
		summary: getAuditSummaryFromFormData(formData),
	});

	revalidatePath("/[locale]/dashboard/administrator/reporting-campaigns", "layout");

	redirect({
		href: `/dashboard/administrator/reporting-campaigns/${id}/edit/settings`,
		locale,
	});
}
