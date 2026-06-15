"use client";

import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { EntityFormHeader } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/entity-form";
import { UserForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_components/user-form";
import { createUserAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/create-user.action";

interface UserCreateFormProps {
	canCurrentUserManageAdmins: boolean;
}

export function UserCreateForm(props: Readonly<UserCreateFormProps>): ReactNode {
	const { canCurrentUserManageAdmins } = props;
	const t = useExtracted();

	return (
		<Fragment>
			<EntityFormHeader title={t("New user")} />

			<UserForm
				canCurrentUserManageAdmins={canCurrentUserManageAdmins}
				formAction={createUserAction}
			/>
		</Fragment>
	);
}
