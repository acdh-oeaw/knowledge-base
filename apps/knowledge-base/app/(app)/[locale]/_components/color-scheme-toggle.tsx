import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { ColorSchemeToggle as ClientColorSchemeToggle } from "@/app/(app)/[locale]/_components/color-scheme-toggle.client";

export function ColorSchemeToggle(): ReactNode {
	const t = useExtracted();

	return <ClientColorSchemeToggle label={t("Toggle color scheme")} />;
}
