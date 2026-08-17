"use client";

import { Avatar } from "@dariah-eric/ui/avatar";
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
import {
	ArrowLeftStartOnRectangleIcon,
	Cog6ToothIcon,
	DocumentTextIcon,
	Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { signOutAction } from "@/lib/auth/sign-out.action";

interface UserMenuProps {
	user: {
		name: string;
		email: string;
	};
}

export function UserMenu(props: Readonly<UserMenuProps>): ReactNode {
	const { user } = props;

	const t = useExtracted();

	return (
		<Menu>
			<MenuTrigger aria-label={t("Open menu")}>
				<Avatar initials={user.name.at(0)} />
			</MenuTrigger>

			<MenuContent className="min-inline-64" popover={{ placement: "bottom end" }}>
				<MenuSection>
					<MenuHeader separator={true}>
						<span className="block">{user.name}</span>
						<span className="font-normal text-muted-fg">{user.email}</span>
					</MenuHeader>
				</MenuSection>

				<MenuItem href="/dashboard">
					<Squares2X2Icon />
					<MenuLabel>Dashboard</MenuLabel>
				</MenuItem>

				<MenuItem href="/auth/settings">
					<Cog6ToothIcon />
					<MenuLabel>Settings</MenuLabel>
				</MenuItem>

				<MenuSeparator />

				<MenuItem href="/documentation">
					<DocumentTextIcon />
					<MenuLabel>Documentation</MenuLabel>
				</MenuItem>

				<MenuSeparator />

				<MenuItem
					onAction={() => {
						void signOutAction();
					}}
				>
					<ArrowLeftStartOnRectangleIcon />
					<MenuLabel>Sign out</MenuLabel>
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}
