"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import {
	canManageAdminAccounts,
	countAdminManagers,
	isRemovingAdminManagementPrivilege,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/admin-management";
import { UpdateUserActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/update-user.schema";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const updateUserAction = createMutationAction({
	schema: UpdateUserActionInputSchema,
	requireAdmin: true,
	audit: { action: "update", subjectType: "users" },
	revalidate: "/[locale]/dashboard/administrator/users",
	redirect: "/dashboard/administrator/users",

	async preCheck({ input, ctx }) {
		const t = await getExtracted();
		const canManageAdminsFlag = input.role === "admin" && input.canManageAdmins === "true";

		const existing = await db.query.users.findFirst({
			where: { id: input.id },
			columns: { email: true, role: true, canManageAdmins: true },
		});

		if (existing == null) {
			return createActionStateError({ message: t("User not found.") });
		}

		const isPrivilegedUser = existing.role === "admin" || input.role === "admin";
		if (isPrivilegedUser && !canManageAdminAccounts(ctx.user)) {
			return createActionStateError({
				message: t("You are not allowed to change admin accounts."),
			});
		}

		if (
			ctx.user.id === input.id &&
			isRemovingAdminManagementPrivilege(existing, {
				role: input.role,
				canManageAdmins: canManageAdminsFlag,
			})
		) {
			return createActionStateError({
				message: t("You cannot remove your own ability to manage admin accounts."),
			});
		}

		if (
			isRemovingAdminManagementPrivilege(existing, {
				role: input.role,
				canManageAdmins: canManageAdminsFlag,
			}) &&
			(await countAdminManagers()) <= 1
		) {
			return createActionStateError({
				message: t("At least one admin user must be allowed to manage admin accounts."),
			});
		}

		if (
			existing.email.toLowerCase() !== input.email.toLowerCase() &&
			!(await auth.isEmailAvailable(input.email))
		) {
			return createActionStateError({
				message: t("This email address is already in use."),
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		const canManageAdminsFlag = input.role === "admin" && input.canManageAdmins === "true";

		await tx
			.update(schema.users)
			.set({
				name: input.name,
				email: input.email,
				role: input.role,
				canManageAdmins: canManageAdminsFlag,
				// The form submits actor *document* ids.
				personDocumentId: input.personId ?? null,
				organisationalUnitDocumentId: input.organisationalUnitId ?? null,
			})
			.where(eq(schema.users.id, input.id));

		return { subjectId: input.id };
	},
});
