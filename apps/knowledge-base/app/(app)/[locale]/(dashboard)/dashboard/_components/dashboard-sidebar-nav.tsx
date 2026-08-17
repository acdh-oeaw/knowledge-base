"use client";

import type { User } from "@dariah-eric/auth";
import { Avatar } from "@dariah-eric/ui/avatar";
import { Button } from "@dariah-eric/ui/button";
import {
	Menu,
	MenuContent,
	MenuHeader,
	MenuItem,
	MenuLabel,
	MenuSection,
	MenuSeparator,
	MenuTrigger,
} from "@dariah-eric/ui/menu";
import { Separator } from "@dariah-eric/ui/separator";
import { SidebarNav, SidebarTrigger, useSidebar } from "@dariah-eric/ui/sidebar";
import {
	CommandLineIcon as IconCommandRegular,
	Squares2X2Icon as IconDashboard,
	ArrowLeftStartOnRectangleIcon as IconLogout,
	MoonIcon as IconMoon,
	MagnifyingGlassIcon as IconSearch,
	Cog6ToothIcon as IconSettings,
	SunIcon as IconSun,
} from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { useDashboardCommandPalette } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/dashboard-command-palette-context";
import { ColorSchemeToggle } from "@/app/(app)/[locale]/_components/color-scheme-toggle.client";
import { signOutAction } from "@/lib/auth/sign-out.action";
import { useColorScheme } from "@/lib/color-scheme/use-color-scheme";

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
			<span className="flex items-center gap-x-4">
				<SidebarTrigger className="-mx-2" />
				<Separator className="block-6" orientation="vertical" />
				{breadcrumbs}
			</span>
			<div className="ms-auto flex items-center gap-x-2">
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

interface UserMenuProps {
	onOpenCommandMenu: () => void;
	user: User;
}

function UserMenu(props: Readonly<UserMenuProps>): ReactNode {
	const { onOpenCommandMenu, user } = props;

	const { colorScheme } = useColorScheme();

	const t = useExtracted();

	return (
		<Menu>
			<MenuTrigger aria-label={t("Open menu")}>
				<Avatar alt={user.name} initials={user.name.at(0)} />
			</MenuTrigger>
			<MenuContent className="min-inline-60" placement="bottom">
				<MenuSection>
					<MenuHeader separator={true}>
						<span className="block">{user.name}</span>
						<span className="font-normal text-muted-fg">{user.email}</span>
					</MenuHeader>
				</MenuSection>
				<MenuItem href="/dashboard">
					<IconDashboard />
					<MenuLabel>{t("Dashboard")}</MenuLabel>
				</MenuItem>
				<MenuItem href="/auth/settings">
					<IconSettings />
					<MenuLabel>{t("Settings")}</MenuLabel>
				</MenuItem>
				<MenuSeparator />
				<MenuItem onAction={onOpenCommandMenu}>
					<IconCommandRegular />
					<MenuLabel>{t("Command menu")}</MenuLabel>
				</MenuItem>
				<MenuItem className="[&>[slot=label]+[data-slot=icon]]:inset-bs-1.5 [&>[slot=label]+[data-slot=icon]]:inset-e-11">
					{colorScheme === "dark" ? <IconMoon /> : <IconSun />}
					<MenuLabel>{t("Color scheme")}</MenuLabel>
					<span data-slot="icon">
						<ColorSchemeToggle className="ms-auto" label={t("Toggle color scheme")} />
					</span>
				</MenuItem>
				<MenuSeparator />
				<MenuItem href="/documentation">
					<MenuLabel>{t("Documentation")}</MenuLabel>
				</MenuItem>
				<MenuSeparator />
				<MenuItem
					onAction={() => {
						void signOutAction();
					}}
				>
					<IconLogout />
					<MenuLabel>{t("Sign out")}</MenuLabel>
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}
