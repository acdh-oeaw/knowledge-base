"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq, sql } from "@/lib/db/sql";

export async function moveDocumentPolicyGroupAction(
	id: string,
	direction: "up" | "down",
): Promise<void> {
	const auditSession = await assertAdmin();

	await db.transaction(async (tx) => {
		await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('document_policy_groups_order'))`);
		const siblings = await tx
			.select({
				id: schema.documentPolicyGroups.id,
				position: schema.documentPolicyGroups.position,
			})
			.from(schema.documentPolicyGroups)
			.orderBy(schema.documentPolicyGroups.position, schema.documentPolicyGroups.label);

		const currentIndex = siblings.findIndex((sibling) => sibling.id === id);
		if (currentIndex < 0) {
			return;
		}
		const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

		if (targetIndex < 0 || targetIndex >= siblings.length) {
			return;
		}

		const [group] = siblings.splice(currentIndex, 1);
		if (group == null) {
			return;
		}
		siblings.splice(targetIndex, 0, group);

		// Rewrite the ordered set rather than swapping raw values: equal legacy positions would make a
		// swap a successful no-op. This also closes any gaps left by deleted groups.
		for (const [position, sibling] of siblings.entries()) {
			if (sibling.position !== position) {
				await tx
					.update(schema.documentPolicyGroups)
					.set({ position })
					.where(eq(schema.documentPolicyGroups.id, sibling.id));
			}
		}
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
