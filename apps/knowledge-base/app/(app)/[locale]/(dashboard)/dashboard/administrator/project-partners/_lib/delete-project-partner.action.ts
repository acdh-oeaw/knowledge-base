"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function deleteProjectPartnerAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();

	// Snapshot the label while the row still exists, so the audit log doesn't fall back to the uuid.
	const subjectLabel = await resolveAuditSubjectLabel("project_partners", id);

	await db
		.delete(schema.projectsToOrganisationalUnits)
		.where(eq(schema.projectsToOrganisationalUnits.id, id));

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "project_partners",
		subjectId: id,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator", "layout");
}
