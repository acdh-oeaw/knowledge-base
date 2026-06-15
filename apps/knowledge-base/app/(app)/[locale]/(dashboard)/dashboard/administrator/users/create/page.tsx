import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { UserCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/users/_components/user-create-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCreateUserPageProps extends PageProps<"/[locale]/dashboard/administrator/users/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCreateUserPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - New user"),
	});

	return metadata;
}

export default async function DashboardAdministratorCreateUserPage(
	_props: Readonly<DashboardAdministratorCreateUserPageProps>,
): Promise<ReactNode> {
	const { user: currentUser } = await assertAuthenticated();

	return <UserCreateForm canCurrentUserManageAdmins={currentUser.canManageAdmins} />;
}
