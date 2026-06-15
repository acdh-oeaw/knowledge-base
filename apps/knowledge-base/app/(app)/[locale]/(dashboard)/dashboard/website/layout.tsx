import type { ReactNode } from "react";

import { assertAdminPageAccess } from "@/lib/auth/session";

interface DashboardWebsiteLayoutProps extends LayoutProps<"/[locale]/dashboard/website"> {}

export default async function DashboardWebsiteLayout(
	props: Readonly<DashboardWebsiteLayoutProps>,
): Promise<ReactNode> {
	const { children } = props;

	await assertAdminPageAccess();

	return children;
}
