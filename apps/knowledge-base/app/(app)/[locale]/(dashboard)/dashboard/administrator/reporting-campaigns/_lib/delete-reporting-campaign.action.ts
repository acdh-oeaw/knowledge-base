"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function deleteReportingCampaignAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();

	await db.delete(schema.reportingCampaigns).where(eq(schema.reportingCampaigns.id, id));

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "reporting_campaigns",
		subjectId: id,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator/reporting-campaigns", "layout");
}
