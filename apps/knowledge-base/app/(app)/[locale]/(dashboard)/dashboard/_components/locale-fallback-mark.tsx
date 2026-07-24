"use client";

import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

/** Inline marker for a relation-list item shown in the default language, not the selected one. */
export function LocaleFallbackMark(): ReactNode {
	const t = useExtracted();

	return <span className="ms-1 text-xs text-muted-fg italic">({t("default language")})</span>;
}
