"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { assertCanManageCountryInstitutionRelation } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/authorize-country-institution-relation";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

/** Delegated counterpart of `endUnitRelationAction` for country partner-institution relations. */
export async function endDelegatedUnitRelationAction(id: string, end: Date): Promise<void> {
	const { user } = await assertAuthenticated();

	const relation = await db.query.organisationalUnitsRelations.findFirst({
		where: { id },
		columns: { duration: true, unitDocumentId: true, relatedUnitDocumentId: true },
	});

	if (relation == null) {
		return;
	}

	await assertCanManageCountryInstitutionRelation(user, {
		institutionDocumentId: relation.unitDocumentId,
		relatedUnitDocumentId: relation.relatedUnitDocumentId,
	});

	await db
		.update(schema.organisationalUnitsRelations)
		.set({ duration: { start: relation.duration.start, end } })
		.where(eq(schema.organisationalUnitsRelations.id, id));

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "relation_end",
		subjectType: "end_unit_relation",
		subjectId: id,
		summary: { end },
	});

	revalidatePath("/[locale]/dashboard/countries", "layout");
}
