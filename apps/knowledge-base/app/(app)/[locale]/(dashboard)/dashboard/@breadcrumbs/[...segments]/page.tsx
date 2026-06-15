import type { ReactNode } from "react";

import { getBreadcrumbLabels } from "@/app/(app)/[locale]/(dashboard)/dashboard/@breadcrumbs/_lib/get-breadcrumb-labels";
import { DashboardBreadcrumbs } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/dashboard-breadcrumbs";

interface BreadcrumbsSlotProps extends PageProps<"/[locale]/dashboard/[...segments]"> {}

export default async function BreadcrumbsSlot(
	props: Readonly<BreadcrumbsSlotProps>,
): Promise<ReactNode> {
	const { segments } = await props.params;
	const labels = await getBreadcrumbLabels(segments);

	return <DashboardBreadcrumbs labels={labels} />;
}
