"use client";

import { type ReactNode, useState } from "react";

import { CommandPalette } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/command-palette";
import { DashboardCommandPaletteContext } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/dashboard-command-palette-context";
import type { UserOrganisationalUnitScopes } from "@/lib/data/user-organisational-units";

interface DashboardCommandPaletteProviderProps {
	children: ReactNode;
	isAdmin: boolean;
	organisationalUnitScopes: UserOrganisationalUnitScopes;
}

export function DashboardCommandPaletteProvider(
	props: Readonly<DashboardCommandPaletteProviderProps>,
): ReactNode {
	const { children, isAdmin, organisationalUnitScopes } = props;
	const [isOpen, setIsOpen] = useState(false);

	return (
		<DashboardCommandPaletteContext
			value={{
				openCommandPalette() {
					setIsOpen(true);
				},
			}}
		>
			<CommandPalette
				isAdmin={isAdmin}
				isOpen={isOpen}
				organisationalUnitScopes={organisationalUnitScopes}
				setIsOpen={setIsOpen}
			/>
			{children}
		</DashboardCommandPaletteContext>
	);
}
