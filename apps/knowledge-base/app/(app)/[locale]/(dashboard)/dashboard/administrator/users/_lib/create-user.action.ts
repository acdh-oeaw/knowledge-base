"use server";

import * as schema from "@dariah-eric/database/schema";
import { createActionStateError } from "@dariah-eric/next-lib/actions";
import { getExtracted } from "next-intl/server";

import { canManageAdminAccounts } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/admin-management";
import { CreateUserActionInputSchema } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/create-user.schema";
import { auth } from "@/lib/auth";
import { eq } from "@/lib/db/sql";
import { createMutationAction } from "@/lib/server/create-mutation-action";

export const createUserAction = createMutationAction({
	schema: CreateUserActionInputSchema,
	requireAdmin: true,
	audit: { action: "create", subjectType: "users" },
	revalidate: "/[locale]/dashboard/administrator/users",
	redirect: "/dashboard/administrator/users",

	async preCheck({ input, ctx }) {
		const t = await getExtracted();

		if (input.role === "admin" && !canManageAdminAccounts(ctx.user)) {
			return createActionStateError({
				message: t("You are not allowed to create admin users."),
			});
		}

		if (!(await auth.isEmailAvailable(input.email))) {
			return createActionStateError({
				message: t("This email address is already in use."),
			});
		}

		return undefined;
	},

	async mutate(tx, input) {
		const canManageAdminsFlag = input.canManageAdmins === "true";

		const user = await auth.createUser(input.email, input.name, input.password);

		await tx
			.update(schema.users)
			.set({
				role: input.role,
				canManageAdmins: input.role === "admin" ? canManageAdminsFlag : false,
				// The form submits actor *document* ids.
				personDocumentId: input.personId ?? null,
				organisationalUnitDocumentId: input.organisationalUnitId ?? null,
			})
			.where(eq(schema.users.id, user.id));

		return { subjectId: user.id };
	},
});
