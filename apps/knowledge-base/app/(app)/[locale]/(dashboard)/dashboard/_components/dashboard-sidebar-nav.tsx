"use client";

import type { User } from "@dariah-eric/auth";
import { Button } from "@dariah-eric/ui/button";
import { Separator } from "@dariah-eric/ui/separator";
import { SidebarNav, SidebarTrigger, useSidebar } from "@dariah-eric/ui/sidebar";
import { MagnifyingGlassIcon as IconSearch } from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { useDashboardCommandPalette } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/dashboard-command-palette-context";
import { UserMenu } from "@/app/(app)/[locale]/_components/user-menu";

interface DashboardSidebarNavProps {
	breadcrumbs: ReactNode;
	user: User;
}

export function DashboardSidebarNav(props: Readonly<DashboardSidebarNavProps>): ReactNode {
	const { breadcrumbs, user } = props;

	const { isMobile } = useSidebar();
	const { openCommandPalette } = useDashboardCommandPalette();

	const t = useExtracted();

	return (
		<SidebarNav className="border-be bg-sidebar">
			<span className="flex items-center gap-x-4 min-inline-0">
				<SidebarTrigger className="-mx-2 shrink-0" />
				<Separator className="shrink-0 block-6" orientation="vertical" />
				{breadcrumbs}
			</span>
			<div className="ms-auto flex shrink-0 items-center gap-x-2">
				{isMobile ? (
					<Fragment>
						<Button
							aria-label={t("Open command menu")}
							intent="plain"
							isCircle={true}
							onPress={openCommandPalette}
							size="sq-sm"
						>
							<IconSearch />
						</Button>
					</Fragment>
				) : null}
				<UserMenu onOpenCommandMenu={openCommandPalette} user={user} />
			</div>
		</SidebarNav>
	);
}
