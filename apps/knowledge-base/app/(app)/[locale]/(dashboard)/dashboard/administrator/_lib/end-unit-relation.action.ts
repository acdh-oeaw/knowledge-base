"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function endUnitRelationAction(id: string, end: Date): Promise<void> {
	const auditSession = await assertAdmin();

	const relation = await db.query.organisationalUnitsRelations.findFirst({
		where: { id },
		columns: { duration: true },
	});

	if (relation == null) {
		return;
	}

	await db
		.update(schema.organisationalUnitsRelations)
		.set({ duration: { start: relation.duration.start, end } })
		.where(eq(schema.organisationalUnitsRelations.id, id));

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "relation_end",
		subjectType: "end_unit_relation",
		subjectId: id,
		summary: { end },
	});

	revalidatePath("/[locale]/dashboard/administrator", "layout");
}
