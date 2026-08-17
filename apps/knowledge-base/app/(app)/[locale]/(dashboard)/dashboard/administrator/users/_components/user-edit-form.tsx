"use client";

import type * as schema from "@dariah-eric/database/schema";
import { Heading } from "@dariah-eric/ui/heading";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { UserForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_components/user-form";
import { updateUserAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/update-user.action";

interface UserEditFormProps {
	canCurrentUserManageAdmins: boolean;
	user: Pick<schema.User, "id" | "name" | "email" | "role"> & {
		canManageAdmins: boolean;
		person: { id: string; name: string } | null;
		organisationalUnit: { id: string; name: string } | null;
	};
}

export function UserEditForm(props: Readonly<UserEditFormProps>): ReactNode {
	const { canCurrentUserManageAdmins, user } = props;

	const t = useExtracted();

	return (
		<Fragment>
			<Heading>{t("Edit user")}</Heading>

			<UserForm
				canCurrentUserManageAdmins={canCurrentUserManageAdmins}
				formAction={updateUserAction}
				user={user}
			/>
		</Fragment>
	);
}
