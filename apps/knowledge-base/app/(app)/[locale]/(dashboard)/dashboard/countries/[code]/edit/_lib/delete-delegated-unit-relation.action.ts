"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { assertCanManageCountryInstitutionRelation } from "@/app/(app)/[locale]/(dashboard)/dashboard/countries/[code]/edit/_lib/authorize-country-institution-relation";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAuthenticated } from "@/lib/auth/session";
import { resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

/** Delegated counterpart of `deleteUnitRelationAction` for country partner-institution relations. */
export async function deleteDelegatedUnitRelationAction(id: string): Promise<void> {
	const { user } = await assertAuthenticated();

	const relation = await db.query.organisationalUnitsRelations.findFirst({
		where: { id },
		columns: { unitDocumentId: true, relatedUnitDocumentId: true },
	});

	if (relation == null) {
		return;
	}

	await assertCanManageCountryInstitutionRelation(user, {
		institutionDocumentId: relation.unitDocumentId,
		relatedUnitDocumentId: relation.relatedUnitDocumentId,
	});

	// Snapshot the label while the row still exists, so the audit log doesn't fall back to the uuid.
	const subjectLabel = await resolveAuditSubjectLabel("unit_relations", id);

	await db
		.delete(schema.organisationalUnitsRelations)
		.where(eq(schema.organisationalUnitsRelations.id, id));

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "delete",
		subjectType: "unit_relations",
		subjectId: id,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/countries", "layout");
}
