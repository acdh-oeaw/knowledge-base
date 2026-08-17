"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function deleteContributionAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();

	await db.transaction(async (tx) => {
		await tx
			.delete(schema.countryReportContributions)
			.where(eq(schema.countryReportContributions.personToOrgUnitId, id));

		await tx
			.delete(schema.personsToOrganisationalUnits)
			.where(eq(schema.personsToOrganisationalUnits.id, id));
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "contributions",
		subjectId: id,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator/contributions", "layout");
	revalidatePath("/[locale]/dashboard/administrator/person-relations", "layout");
}
