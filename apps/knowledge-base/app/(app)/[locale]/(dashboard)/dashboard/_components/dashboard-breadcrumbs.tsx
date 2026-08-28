"use client";

import { Breadcrumbs, BreadcrumbsItem } from "@dariah-eric/ui/breadcrumbs";
import cn from "clsx/lite";
import { useExtracted } from "next-intl";
import type { ReactNode } from "react";

import { usePathname } from "@/lib/navigation/navigation";

// Dynamic param segments (e.g. slugs/ids) never have their own page — they
// only serve as parents for "edit" or "details" sub-routes.
const ACTION_SEGMENTS = new Set(["edit", "details"]);

interface DashboardBreadcrumbsProps {
	labels?: Record<string, string>;
}

function getBreadcrumbSegments(
	pathname: string,
	labels: Record<string, string> = {},
): Array<{ href?: string; isTruncated: boolean; label: string }> {
	const dashboardPrefix = "/dashboard";

	if (pathname === dashboardPrefix || !pathname.startsWith(dashboardPrefix)) {
		return [];
	}

	const segments = pathname.slice(dashboardPrefix.length).split("/").filter(Boolean);

	return segments.map((segment, index) => {
		const resolvedLabel = labels[segment];
		const label = resolvedLabel ?? decodeURIComponent(segment).replaceAll("-", " ");
		const isLast = index === segments.length - 1;
		const nextSegment = segments[index + 1];
		const isReportYearSegment =
			segments[0] === "reporting" &&
			(segments[1] === "country-reports" || segments[1] === "working-group-reports") &&
			index === 2;
		const isDynamicParam =
			isReportYearSegment || (nextSegment != null && ACTION_SEGMENTS.has(nextSegment));

		const href =
			isLast || isDynamicParam ? undefined : `/dashboard/${segments.slice(0, index + 1).join("/")}`;

		// Only segments which carry an entity name or slug can be arbitrarily long, so those are the
		// only ones allowed to shrink. Route segments keep their intrinsic width.
		const isTruncated = isDynamicParam || resolvedLabel != null;

		return { href, isTruncated, label };
	});
}

export function DashboardBreadcrumbs(props: Readonly<DashboardBreadcrumbsProps> = {}): ReactNode {
	const { labels } = props;
	const pathname = usePathname();
	const segments = getBreadcrumbSegments(pathname, labels);
	const t = useExtracted();

	// Breadcrumb items never wrap, so on small screens we only show the current page and its parent.
	const firstVisibleIndex = segments.length - 2;

	return (
		<Breadcrumbs>
			<BreadcrumbsItem className="hidden sm:flex" href="/dashboard">
				{t("Dashboard")}
			</BreadcrumbsItem>
			{segments.map((segment, index) => (
				<BreadcrumbsItem
					key={[index, segment.href ?? segment.label].join("-")}
					className={cn("capitalize", index < firstVisibleIndex && "hidden sm:flex")}
					href={segment.href}
					isTruncated={segment.isTruncated}
				>
					{segment.label}
				</BreadcrumbsItem>
			))}
		</Breadcrumbs>
	);
}
