import { getLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { assertAuthenticated } from "@/lib/auth/session";
import { resolveWorkingGroupReportId } from "@/lib/data/reporting-urls";
import { redirect } from "@/lib/navigation/navigation";

interface WorkingGroupReportLayoutProps extends LayoutProps<"/[locale]/dashboard/reporting/working-group-reports/[year]/[slug]"> {}

/**
 * Admins manage reports through the `/dashboard/administrator` tree, so send them there from the
 * user-facing reporting routes (consistent with the index redirect in `reporting/page.tsx`). This
 * covers both the per-report view and its `edit/*` subtree.
 */
export default async function WorkingGroupReportLayout(
	props: Readonly<WorkingGroupReportLayoutProps>,
): Promise<ReactNode> {
	const { children, params } = props;

	const { user } = await assertAuthenticated();

	if (user.role === "admin") {
		const { year: routeYear, slug } = await params;
		const id = await resolveWorkingGroupReportId({ year: routeYear, slug });

		if (id == null) {
			notFound();
		}

		redirect({
			href: `/dashboard/administrator/working-group-reports/${id}`,
			locale: await getLocale(),
		});
	}

	return children;
}
