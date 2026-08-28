import type { ReactNode } from "react";

interface RelationTypeSuffixProps {
	/** Human-readable type label, e.g. "Event" or "Publication". */
	type?: string;
}

/**
 * Renders a related entity/resource type as a muted ` (Type)` suffix shown next to its name in
 * read-only detail-page relation lists. Renders nothing when no type is available.
 */
export function RelationTypeSuffix(props: Readonly<RelationTypeSuffixProps>): ReactNode {
	const { type } = props;

	if (type == null || type === "") {
		return null;
	}

	return <span className="text-muted-fg"> ({type})</span>;
}
