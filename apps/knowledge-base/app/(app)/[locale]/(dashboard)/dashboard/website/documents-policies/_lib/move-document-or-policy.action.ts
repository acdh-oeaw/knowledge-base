"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { and, eq, isNull } from "@/lib/db/sql";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function moveDocumentOrPolicyAction(
	id: string,
	direction: "up" | "down",
): Promise<void> {
	const auditSession = await assertAdmin();

	await db.transaction(async (tx) => {
		const item = await tx.query.documentsPolicies.findFirst({
			where: { id },
			columns: { id: true, position: true, groupId: true },
		});

		if (item == null) {
			return;
		}

		const siblings = await tx
			.select({ id: schema.documentsPolicies.id, position: schema.documentsPolicies.position })
			.from(schema.documentsPolicies)
			.where(
				item.groupId != null
					? eq(schema.documentsPolicies.groupId, item.groupId)
					: and(isNull(schema.documentsPolicies.groupId)),
			)
			.orderBy(schema.documentsPolicies.position);

		const currentIndex = siblings.findIndex((s) => s.id === id);
		const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

		if (targetIndex < 0 || targetIndex >= siblings.length) {
			return;
		}

		const target = siblings[targetIndex];
		if (target == null) {
			return;
		}

		await tx
			.update(schema.documentsPolicies)
			.set({ position: target.position })
			.where(eq(schema.documentsPolicies.id, id));

		await tx
			.update(schema.documentsPolicies)
			.set({ position: item.position })
			.where(eq(schema.documentsPolicies.id, target.id));
	});

	after(async () => {
		await dispatchWebhook({ type: "documents-policies" });
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "update",
		subjectType: "documents_policies",
		subjectId: id,
		summary: { direction },
	});

	revalidatePath("/[locale]/dashboard/website/documents-policies", "layout");
}
