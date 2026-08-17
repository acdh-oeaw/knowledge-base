"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { and, eq } from "@/lib/db/sql";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function deleteImpactCaseStudyContributorAction(
	articleId: string,
	personId: string,
): Promise<void> {
	const auditSession = await assertAdmin();

	// articleId and personId are document ids (entities.id); contributors are document-level.
	await db
		.delete(schema.impactCaseStudiesToPersons)
		.where(
			and(
				eq(schema.impactCaseStudiesToPersons.impactCaseStudyDocumentId, articleId),
				eq(schema.impactCaseStudiesToPersons.personDocumentId, personId),
			),
		);

	after(async () => {
		await dispatchWebhook({ type: "impact-case-studies" });
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "impact_case_studies",
		subjectId: articleId,
		summary: { personId },
	});

	revalidatePath("/[locale]/dashboard/website/impact-case-studies", "layout");
}
