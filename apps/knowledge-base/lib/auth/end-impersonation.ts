import type { Session, User } from "@dariah-eric/auth";

import { recordAuditEvent } from "@/lib/audit/audit-log";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Clears an impersonation and records it. Kept apart from the server action so that sign-out can
 * reuse it without depending on the action's redirect to interrupt control flow.
 */
export async function endImpersonation(params: {
	session: Session;
	/** The account being acted as -- the audit subject. */
	impersonatedUser: User;
	/** The admin doing the impersonating -- the audit actor. */
	realUser: User;
}): Promise<void> {
	const { impersonatedUser, realUser, session } = params;

	await auth.stopImpersonation(session.id);

	await recordAuditEvent(db, {
		actorUserId: realUser.id,
		action: "impersonation_end",
		subjectType: "users",
		subjectId: impersonatedUser.id,
		subjectLabel: `${impersonatedUser.name} (${impersonatedUser.email})`,
		summary: {},
	});
}
