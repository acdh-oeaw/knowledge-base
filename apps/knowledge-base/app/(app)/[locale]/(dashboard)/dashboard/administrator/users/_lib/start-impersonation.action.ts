"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { auth } from "@/lib/auth";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { redirect } from "@/lib/navigation/navigation";

/**
 * Re-points the calling admin's session at another user. Every guard that matters lives in the auth
 * service, which re-checks them on every subsequent request too; this action only supplies the
 * session, the audit row, and the redirect.
 */
export async function startImpersonationAction(id: string): Promise<void> {
	const { realUser, session } = await assertAdmin();

	const target = await db.query.users.findFirst({
		where: { id },
		columns: { name: true, email: true },
	});

	if (target == null) {
		throw new Error("User not found.");
	}

	await auth.startImpersonation(session.id, id);

	await recordAuditEvent(db, {
		/**
		 * Attributed to the admin, not the target: this event _is_ the admin's act. Events recorded
		 * once impersonation is under way flip round, being attributed to the impersonated user with
		 * the admin in `impersonatedByUserId`.
		 */
		actorUserId: realUser.id,
		action: "impersonation_start",
		subjectType: "users",
		subjectId: id,
		subjectLabel: `${target.name} (${target.email})`,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard", "layout");

	const locale = await getLocale();
	redirect({ href: "/dashboard", locale });
}
