"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { dispatchWebhook } from "@/lib/webhook/dispatch-webhook";

export async function deleteNavigationItemAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();

	await db.delete(schema.navigationItems).where(eq(schema.navigationItems.id, id));

	after(async () => {
		await dispatchWebhook({ type: "navigation" });
	});

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "navigation",
		subjectId: id,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/website/navigation", "layout");
}
