"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function moveDocumentPolicyGroupAction(
	id: string,
	direction: "up" | "down",
): Promise<void> {
	const auditSession = await assertAdmin();

	await db.transaction(async (tx) => {
		const group = await tx.query.documentPolicyGroups.findFirst({
			where: { id },
			columns: { id: true, position: true },
		});

		if (group == null) {
			return;
		}

		const siblings = await tx
			.select({
				id: schema.documentPolicyGroups.id,
				position: schema.documentPolicyGroups.position,
			})
			.from(schema.documentPolicyGroups)
			.orderBy(schema.documentPolicyGroups.position, schema.documentPolicyGroups.label);

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
			.update(schema.documentPolicyGroups)
			.set({ position: target.position })
			.where(eq(schema.documentPolicyGroups.id, id));

		await tx
			.update(schema.documentPolicyGroups)
			.set({ position: group.position })
			.where(eq(schema.documentPolicyGroups.id, target.id));
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
