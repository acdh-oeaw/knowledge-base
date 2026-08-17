"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function endContributionAction(id: string, end: Date): Promise<void> {
	const auditSession = await assertAdmin();

	const contribution = await db.query.personsToOrganisationalUnits.findFirst({
		where: { id },
		columns: { duration: true },
	});

	if (contribution == null) {
		return;
	}

	await db
		.update(schema.personsToOrganisationalUnits)
		.set({ duration: { start: contribution.duration.start, end } })
		.where(eq(schema.personsToOrganisationalUnits.id, id));

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "relation_end",
		subjectType: "end_contribution",
		subjectId: id,
		summary: { end },
	});

	revalidatePath("/[locale]/dashboard/administrator", "layout");
}
