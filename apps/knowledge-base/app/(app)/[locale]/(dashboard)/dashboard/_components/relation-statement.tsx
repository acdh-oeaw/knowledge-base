"use client";

import { Badge } from "@dariah-eric/ui/badge";
import { useExtracted, useFormatter } from "next-intl";
import type { ReactNode } from "react";

import { RelationLink } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/relation-link";

interface RelationStatementProps {
	source: ReactNode;
	sourceHref?: string | null;
	/**
	 * Whether to render the source node. Defaults to `true`. Set to `false` on a detail page where
	 * the source is the page's own entity (e.g. a project or impact case study) and its name is long
	 * or redundant.
	 */
	showSource?: boolean;
	relation: ReactNode;
	target: ReactNode;
	targetHref?: string | null;
	targetType?: ReactNode;
	duration?: { start: Date; end?: Date | null };
}

export function RelationStatement(props: Readonly<RelationStatementProps>): ReactNode {
	const {
		source,
		sourceHref = null,
		showSource = true,
		relation,
		target,
		targetHref = null,
		targetType,
		duration,
	} = props;

	const t = useExtracted();
	const format = useFormatter();
	const formattedDuration =
		duration == null
			? null
			: duration.end != null
				? format.dateTimeRange(duration.start, duration.end, { dateStyle: "short" })
				: `${format.dateTime(duration.start, { dateStyle: "short" })} - ${t("present")}`;

	return (
		<li className="text-sm">
			{showSource ? (
				<>
					<RelationLink className="font-medium" href={sourceHref}>
						{source}
					</RelationLink>
					{" · "}
				</>
			) : null}
			<span className="text-muted-fg">{relation}</span>
			{" · "}
			<RelationLink className={showSource ? "text-muted-fg" : "font-medium"} href={targetHref}>
				{target}
			</RelationLink>
			{targetType != null ? (
				<>
					{" "}
					<Badge intent="slate">{targetType}</Badge>
				</>
			) : null}
			{formattedDuration != null ? (
				<span className="text-muted-fg">
					{" · "}
					{formattedDuration}
				</span>
			) : null}
		</li>
	);
}
