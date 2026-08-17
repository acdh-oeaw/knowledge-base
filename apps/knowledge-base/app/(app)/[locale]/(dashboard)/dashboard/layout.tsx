import { SidebarInset, SidebarProvider } from "@dariah-eric/ui/sidebar";
import { getExtracted } from "next-intl/server";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Fragment, type ReactNode } from "react";

import { DashboardCommandPaletteProvider } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/dashboard-command-palette";
import { DashboardSidebar } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/dashboard-sidebar";
import { DashboardSidebarNav } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/dashboard-sidebar-nav";
import { mainContentId } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/main";
import { SkipLink } from "@/components/skip-link";
import { assertAuthenticated } from "@/lib/auth/session";

interface DashbardLayoutProps extends LayoutProps<"/[locale]/dashboard"> {
	breadcrumbs: ReactNode;
}

export default async function DashbardLayout(
	props: Readonly<DashbardLayoutProps>,
): Promise<ReactNode> {
	const { breadcrumbs, children } = props;

	const t = await getExtracted();

	/**
	 * We cannot access the database when building the app in github actions, so we need to ensure
	 * that all database access happens at request time only.
	 */
	await connection();

	const store = await cookies();
	const sidebarState = store.get("sidebar_state");
	const defaultOpen = sidebarState ? sidebarState.value === "true" : true;

	const { user } = await assertAuthenticated();

	return (
		<Fragment>
			<SkipLink href={`#${mainContentId}`}>{t("Skip to main content")}</SkipLink>

			<SidebarProvider defaultOpen={defaultOpen}>
				<DashboardCommandPaletteProvider isAdmin={user.role === "admin"}>
					<DashboardSidebar collapsible="dock" isAdmin={user.role === "admin"} />

					<SidebarInset>
						<DashboardSidebarNav breadcrumbs={breadcrumbs} user={user} />

						<div className="flex flex-col gap-y-(--layout-padding) p-(--layout-padding) [--layout-padding:--spacing(4)] sm:[--layout-padding:--spacing(6)]">
							{children}
						</div>
					</SidebarInset>
				</DashboardCommandPaletteProvider>
			</SidebarProvider>
		</Fragment>
	);
}
