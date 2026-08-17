"use client";

import { Link } from "@dariah-eric/ui/link";
import type { ReactNode } from "react";

interface RelationLinkProps {
	/** Detail-page href, or `null` when the related entity has no detail page. */
	href: string | null;
	className?: string;
	children: ReactNode;
}

/**
 * Renders the name of a related entity as a link to its detail page, falling back to plain text (a
 * `span`) when no detail page exists for that entity type.
 */
export function RelationLink(props: Readonly<RelationLinkProps>): ReactNode {
	const { href, className, children } = props;

	if (href == null) {
		return <span className={className}>{children}</span>;
	}

	return (
		<Link className={className != null ? `${className} underline` : "underline"} href={href}>
			{children}
		</Link>
	);
}
