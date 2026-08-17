"use client";

import { Breadcrumbs, BreadcrumbsItem } from "@dariah-eric/ui/breadcrumbs";
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
): Array<{ href?: string; label: string }> {
	const dashboardPrefix = "/dashboard";

	if (pathname === dashboardPrefix || !pathname.startsWith(dashboardPrefix)) {
		return [];
	}

	const segments = pathname.slice(dashboardPrefix.length).split("/").filter(Boolean);

	return segments.map((segment, index) => {
		const label = labels[segment] ?? decodeURIComponent(segment).replaceAll("-", " ");
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

		return { href, label };
	});
}

export function DashboardBreadcrumbs(props: Readonly<DashboardBreadcrumbsProps> = {}): ReactNode {
	const { labels } = props;
	const pathname = usePathname();
	const segments = getBreadcrumbSegments(pathname, labels);
	const t = useExtracted();

	return (
		<Breadcrumbs>
			<BreadcrumbsItem className="hidden sm:flex" href="/dashboard">
				{t("Dashboard")}
			</BreadcrumbsItem>
			{segments.map((segment, index) => {
				if (segment.href == null) {
					return (
						<BreadcrumbsItem key={[index, segment.label].join("-")} className="capitalize">
							{segment.label}
						</BreadcrumbsItem>
					);
				}

				return (
					<BreadcrumbsItem
						key={[index, segment.href].join("-")}
						className="capitalize"
						href={segment.href}
					>
						{segment.label}
					</BreadcrumbsItem>
				);
			})}
		</Breadcrumbs>
	);
}
