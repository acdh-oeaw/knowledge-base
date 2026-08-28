"use server";

import * as schema from "@dariah-eric/database/schema";
import { revalidatePath } from "next/cache";

import {
	canManageAdminAccounts,
	countAdminManagers,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/admin-management";
import { recordAuditEvent } from "@/lib/audit/audit-log";
import { assertAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";

export async function deleteUserAction(id: string): Promise<void> {
	const { user: currentUser } = await assertAdmin();

	if (currentUser.id === id) {
		throw new Error("Cannot delete your own account.");
	}

	const user = await db.query.users.findFirst({
		where: { id },
		columns: { role: true, canManageAdmins: true, name: true, email: true },
	});

	if (user == null) {
		throw new Error("User not found.");
	}

	// Snapshot the label now: once the row is gone the audit log can only show the uuid.
	const subjectLabel = `${user.name} (${user.email})`;

	if (user.role === "admin" && !canManageAdminAccounts(currentUser)) {
		throw new Error("You are not allowed to delete admin accounts.");
	}

	if (user.role === "admin" && user.canManageAdmins && (await countAdminManagers()) <= 1) {
		throw new Error("At least one admin user must be allowed to manage admin accounts.");
	}

	await db.delete(schema.users).where(eq(schema.users.id, id));

	await recordAuditEvent(db, {
		actorUserId: currentUser.id,
		action: "delete",
		subjectType: "users",
		subjectId: id,
		subjectLabel,
		summary: {},
	});

	revalidatePath("/[locale]/dashboard/administrator/users", "layout");
}
