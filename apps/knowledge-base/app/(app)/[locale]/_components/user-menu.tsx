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
	CommandLineIcon as IconCommandMenu,
	EnvelopeIcon as IconContact,
	Squares2X2Icon as IconDashboard,
	DocumentTextIcon as IconDocumentation,
	InformationCircleIcon as IconImprint,
	ShieldCheckIcon as IconPrivacyPolicy,
	Cog6ToothIcon as IconSettings,
	ArrowLeftStartOnRectangleIcon as IconSignOut,
	ScaleIcon as IconTermsOfUse,
} from "@heroicons/react/24/outline";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

import { signOutAction } from "@/lib/auth/sign-out.action";

interface UserMenuProps {
	/** Only the dashboard has a command palette to open. */
	onOpenCommandMenu?: () => void;
	user: {
		name: string;
		email: string;
	};
}

export function UserMenu(props: Readonly<UserMenuProps>): ReactNode {
	const { onOpenCommandMenu, user } = props;

	const t = useExtracted();

	return (
		<Menu>
			<MenuTrigger aria-label={t("Open menu")}>
				<Avatar alt={user.name} initials={user.name.at(0)} />
			</MenuTrigger>

			<MenuContent className="min-inline-60" popover={{ placement: "bottom end" }}>
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
					<MenuLabel>{t("Account settings")}</MenuLabel>
				</MenuItem>

				<MenuSeparator />

				{onOpenCommandMenu != null ? (
					<Fragment>
						<MenuItem onAction={onOpenCommandMenu}>
							<IconCommandMenu />
							<MenuLabel>{t("Command menu")}</MenuLabel>
						</MenuItem>

						<MenuSeparator />
					</Fragment>
				) : null}

				<MenuItem href="/documentation">
					<IconDocumentation />
					<MenuLabel>{t("Documentation")}</MenuLabel>
				</MenuItem>

				<MenuItem href="/contact">
					<IconContact />
					<MenuLabel>{t("Contact")}</MenuLabel>
				</MenuItem>

				<MenuSeparator />

				<MenuItem href="/privacy-policy">
					<IconPrivacyPolicy />
					<MenuLabel>{t("Privacy policy")}</MenuLabel>
				</MenuItem>

				<MenuItem href="/terms-of-use">
					<IconTermsOfUse />
					<MenuLabel>{t("Terms of use")}</MenuLabel>
				</MenuItem>

				<MenuItem href="/imprint">
					<IconImprint />
					<MenuLabel>{t("Imprint")}</MenuLabel>
				</MenuItem>

				<MenuSeparator />

				<MenuItem
					onAction={() => {
						void signOutAction();
					}}
				>
					<IconSignOut />
					<MenuLabel>{t("Sign out")}</MenuLabel>
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}
