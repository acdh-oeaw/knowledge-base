"use server";

import * as schema from "@acdh-knowledge-base/database/schema";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { and, eq, isNull } from "@/lib/db/sql";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function moveNavigationItemAction(
	id: string,
	direction: "up" | "down",
): Promise<void> {
	const auditSession = await assertAdmin();

	await db.transaction(async (tx) => {
		const item = await tx.query.navigationItems.findFirst({
			where: { id },
			columns: { id: true, position: true, menuId: true, parentId: true },
		});

		if (item == null) {
			return;
		}

		const siblings = await tx
			.select({ id: schema.navigationItems.id, position: schema.navigationItems.position })
			.from(schema.navigationItems)
			.where(
				item.parentId != null
					? eq(schema.navigationItems.parentId, item.parentId)
					: and(
							eq(schema.navigationItems.menuId, item.menuId),
							isNull(schema.navigationItems.parentId),
						),
			)
			.orderBy(schema.navigationItems.position);

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
			.update(schema.navigationItems)
			.set({ position: target.position })
			.where(eq(schema.navigationItems.id, id));

		await tx
			.update(schema.navigationItems)
			.set({ position: item.position })
			.where(eq(schema.navigationItems.id, target.id));
	});

	after(async () => {
		await dispatchWebhook({ type: "navigation" });
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "update",
		subjectType: "navigation",
		subjectId: id,
		summary: { direction },
	});

	revalidatePath("/[locale]/dashboard/website/navigation", "layout");
}
