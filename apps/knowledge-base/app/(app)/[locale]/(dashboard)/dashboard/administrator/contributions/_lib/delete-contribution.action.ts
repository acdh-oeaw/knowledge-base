"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function deleteContributionAction(id: string): Promise<void> {
	const { user } = await assertAuthenticated();

	const contribution = await db.query.personsToOrganisationalUnits.findFirst({
		where: { id },
		columns: { organisationalUnitDocumentId: true },
	});

	if (contribution == null) {
		return;
	}

	// Admins always pass; delegated callers may only manage people on units they are scoped to edit.
	await assertCan(user, "update", {
		type: "organisational_unit",
		id: contribution.organisationalUnitDocumentId,
	});

	// Snapshot the label while the row still exists, so the audit log doesn't fall back to the uuid.
	const subjectLabel = await resolveAuditSubjectLabel("contributions", id);

	await db.transaction(async (tx) => {
		await tx
			.delete(schema.countryReportContributions)
			.where(eq(schema.countryReportContributions.personToOrgUnitId, id));

		await tx
			.delete(schema.personsToOrganisationalUnits)
			.where(eq(schema.personsToOrganisationalUnits.id, id));
	});

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "delete",
		subjectType: "contributions",
		subjectId: id,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator/contributions", "layout");
	revalidatePath("/[locale]/dashboard/administrator/person-relations", "layout");
	await dispatchWebhook({ type: "persons" });
}
