"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { documentsPoliciesLifecycleAdapter } from "@/lib/data/documents-policies.lifecycle-adapter";
import { discardDraftVersion } from "@/lib/data/entity-lifecycle";
import { db } from "@/lib/db";
import { redirect } from "@/lib/navigation/navigation";

export async function discardDocumentOrPolicyDraftAction(documentId: string): Promise<void> {
	const auditSession = await assertAdmin();

	await db.transaction(async (tx) => {
		await discardDraftVersion(tx, documentId, documentsPoliciesLifecycleAdapter);
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "discard_draft",
		subjectType: "documents_policies",
		subjectId: documentId,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/website/documents-policies", "layout");

	const locale = await getLocale();
	redirect({ href: "/dashboard/website/documents-policies", locale });
}
