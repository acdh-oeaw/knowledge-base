"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq, isNull } from "@/lib/db/sql";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function deleteDocumentPolicyGroupAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();

	// The subject is a document-policy *group* (not an entity document), so snapshot its label from the
	// group table before deletion — the generic entity resolver can't recover it afterwards.
	const group = await db.query.documentPolicyGroups.findFirst({
		where: { id },
		columns: { label: true },
	});
	const subjectLabel = group?.label ?? null;

	await db.transaction(async (tx) => {
		await tx
			.update(schema.documentsPolicies)
			.set({ groupId: null })
			.where(eq(schema.documentsPolicies.groupId, id));

		const ungrouped = await tx
			.select({ id: schema.documentsPolicies.id })
			.from(schema.documentsPolicies)
			.where(isNull(schema.documentsPolicies.groupId))
			.orderBy(schema.documentsPolicies.position);

		await Promise.all(
			ungrouped.map((doc, index) =>
				tx
					.update(schema.documentsPolicies)
					.set({ position: index })
					.where(eq(schema.documentsPolicies.id, doc.id)),
			),
		);

		await tx.delete(schema.documentPolicyGroups).where(eq(schema.documentPolicyGroups.id, id));
	});

	after(async () => {
		await dispatchWebhook({ type: "documents-policies" });
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "documents_policies",
		subjectId: id,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/website/documents-policies", "layout");
}
