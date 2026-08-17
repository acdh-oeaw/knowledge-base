"use client";

import { Badge } from "@dariah-eric/ui/badge";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode } from "react";

interface EntityLifecycleStatusBadgeProps {
	hasDraft: boolean;
	isPublished: boolean;
}

export function EntityLifecycleStatusBadge(
	props: Readonly<EntityLifecycleStatusBadgeProps>,
): ReactNode {
	const { hasDraft, isPublished } = props;
	const t = useExtracted();

	if (hasDraft && isPublished) {
		return (
			<div className="flex gap-2">
				<Badge intent="success">{t("Published")}</Badge>
				<Badge intent="warning">{t("Draft")}</Badge>
			</div>
		);
	}

	if (hasDraft) {
		return <Badge intent="warning">{t("Draft")}</Badge>;
	}

	if (isPublished) {
		return <Badge intent="success">{t("Published")}</Badge>;
	}

	return <Fragment />;
}
