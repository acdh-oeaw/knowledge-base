"use client";

import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { Link } from "@dariah-eric/ui/link";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { useSearchParams } from "@/lib/navigation/navigation";

/** Keeps the locale being viewed when switching between draft and published. */
function withLocale(href: string, locale: string | null): string {
	if (locale == null) {
		return href;
	}

	return `${href}${href.includes("?") ? "&" : "?"}locale=${encodeURIComponent(locale)}`;
}

interface VersionSelectorProps {
	hasDraft: boolean;
	isPublished: boolean;
	selectedVersion: "draft" | "published";
	draftHref: string;
	publishedHref: string;
}

export function VersionSelector(props: Readonly<VersionSelectorProps>): ReactNode {
	const { hasDraft, isPublished, selectedVersion, draftHref, publishedHref } = props;

	const t = useExtracted();
	const locale = useSearchParams().get("locale");

	if (!hasDraft || !isPublished) {
		return null;
	}

	return (
		<div className="flex items-center gap-x-1 rounded-md border p-1">
			<Link
				className={buttonStyles({
					intent: selectedVersion === "draft" ? "primary" : "plain",
					size: "sm",
				})}
				href={withLocale(draftHref, locale)}
			>
				{t("Draft")}
			</Link>
			<Link
				className={buttonStyles({
					intent: selectedVersion === "published" ? "primary" : "plain",
					size: "sm",
				})}
				href={withLocale(publishedHref, locale)}
			>
				{t("Published")}
			</Link>
		</div>
	);
}
