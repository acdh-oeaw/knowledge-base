"use client";

import { Badge } from "@dariah-eric/ui/badge";
import { ListBoxDescription, ListBoxLabel } from "@dariah-eric/ui/list-box";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import type { EntityOption } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/maintenance/_components/entity-option";

/**
 * Dropdown option for the maintenance entity pickers, surfacing the slug: two entities can share a
 * label (e.g. two "Cyprus University of Technology" institutions), so the slug is what tells them
 * apart while picking.
 *
 * A never-published draft is badged — it is worth knowing that its name may only be a slug, and
 * that acting on it has different consequences (it has no public URL to break). Options from the
 * relation-options endpoint carry no `state` and are never badged, since that endpoint only ever
 * returns published documents.
 */
export function EntityOptionItem(props: Readonly<{ item: EntityOption }>): ReactNode {
	const { item } = props;

	const t = useExtracted();

	const meta = [item.description, item.slug].filter((value) => value != null && value !== "");

	return (
		<div className="col-start-2 flex flex-col">
			<div className="flex items-center gap-x-2">
				<ListBoxLabel className="truncate">{item.name}</ListBoxLabel>
				{item.state === "draft" ? <Badge intent="emerald">{t("Draft")}</Badge> : null}
			</div>
			{meta.length > 0 ? (
				<ListBoxDescription className="break-all">{meta.join(" · ")}</ListBoxDescription>
			) : null}
		</div>
	);
}

export function renderEntityOption(item: EntityOption): ReactNode {
	return <EntityOptionItem item={item} />;
}
