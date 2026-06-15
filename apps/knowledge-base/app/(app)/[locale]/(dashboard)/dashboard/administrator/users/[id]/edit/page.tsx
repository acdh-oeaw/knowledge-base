import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { forbidden, notFound } from "next/navigation";
import type { ReactNode } from "react";

import { UserEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_components/user-edit-form";
import { canManageAdminAccounts } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_lib/admin-management";
import { assertAuthenticated } from "@/lib/auth/session";
import { getUserForAdmin } from "@/lib/data/users";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditUserPageProps extends PageProps<"/[locale]/dashboard/administrator/users/[id]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditUserPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit user"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditUserPage(
	props: Readonly<DashboardAdministratorEditUserPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user: currentUser } = await assertAuthenticated();
	const user = await getUserForAdmin(currentUser, id);

	if (user == null) {
		notFound();
	}

	if (user.role === "admin" && currentUser.id !== user.id && !canManageAdminAccounts(currentUser)) {
		forbidden();
	}

	return <UserEditForm canCurrentUserManageAdmins={currentUser.canManageAdmins} user={user} />;
}
