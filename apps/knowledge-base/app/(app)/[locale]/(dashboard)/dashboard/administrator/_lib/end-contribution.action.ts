"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertCan } from "@/lib/auth/permissions";
import { assertAuthenticated } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function endContributionAction(id: string, end: Date): Promise<void> {
	const { user } = await assertAuthenticated();

	const contribution = await db.query.personsToOrganisationalUnits.findFirst({
		where: { id },
		columns: { duration: true, organisationalUnitDocumentId: true },
	});

	if (contribution == null) {
		return;
	}

	// Admins always pass; delegated callers may only manage people on units they are scoped to edit.
	await assertCan(user, "update", {
		type: "organisational_unit",
		id: contribution.organisationalUnitDocumentId,
	});

	await db
		.update(schema.personsToOrganisationalUnits)
		.set({ duration: { start: contribution.duration.start, end } })
		.where(eq(schema.personsToOrganisationalUnits.id, id));

	await recordAuditEvent(db, {
		actorUserId: user.id,
		action: "relation_end",
		subjectType: "end_contribution",
		subjectId: id,
		summary: { end },
	});

	revalidatePath("/[locale]/dashboard/administrator", "layout");
	await dispatchWebhook({ type: "persons" });
}
