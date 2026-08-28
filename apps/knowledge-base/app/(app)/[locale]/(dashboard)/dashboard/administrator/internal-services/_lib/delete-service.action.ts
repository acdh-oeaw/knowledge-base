"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { resolveAuditSubjectLabel } from "@/lib/data/audit-log";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function deleteServiceAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();
	const service = await db.query.services.findFirst({
		where: { id },
		columns: { sshocMarketplaceId: true },
	});

	if (service == null || service.sshocMarketplaceId != null) {
		return;
	}

	// Snapshot the label while the row still exists, so the audit log doesn't fall back to the uuid.
	const subjectLabel = await resolveAuditSubjectLabel("internal_services", id);

	await db.transaction(async (tx) => {
		await tx
			.delete(schema.countryReportServiceKpis)
			.where(eq(schema.countryReportServiceKpis.serviceId, id));
		await tx
			.delete(schema.countryReportServices)
			.where(eq(schema.countryReportServices.serviceId, id));
		await tx
			.delete(schema.servicesToSocialMedia)
			.where(eq(schema.servicesToSocialMedia.serviceId, id));
		await tx
			.delete(schema.servicesToOrganisationalUnits)
			.where(eq(schema.servicesToOrganisationalUnits.serviceId, id));
		await tx.delete(schema.services).where(eq(schema.services.id, id));
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "internal_services",
		subjectId: id,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator/internal-services", "layout");
}
