"use client";

import { buttonStyles } from "@dariah-eric/ui/button-styles";
import { Link } from "@dariah-eric/ui/link";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

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
				href={draftHref}
			>
				{t("Draft")}
			</Link>
			<Link
				className={buttonStyles({
					intent: selectedVersion === "published" ? "primary" : "plain",
					size: "sm",
				})}
				href={publishedHref}
			>
				{t("Published")}
			</Link>
		</div>
	);
}
