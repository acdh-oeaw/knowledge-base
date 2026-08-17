"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function deleteSocialMediaAction(id: string): Promise<void> {
	const auditSession = await assertAdmin();

	await db.delete(schema.socialMedia).where(eq(schema.socialMedia.id, id));

	await recordAuditEvent(db, {
		actorUserId: auditSession.user.id,
		action: "delete",
		subjectType: "social_media",
		subjectId: id,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator/social-media", "layout");
}
