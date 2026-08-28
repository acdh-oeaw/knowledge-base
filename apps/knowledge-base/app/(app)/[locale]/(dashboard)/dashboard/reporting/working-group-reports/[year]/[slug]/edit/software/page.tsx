import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkingGroupReportSoftwareScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-software-screen";
import { resolveWorkingGroupReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingWorkingGroupReportSoftwarePageProps extends PageProps<"/[locale]/dashboard/reporting/working-group-reports/[year]/[slug]/edit/software"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingWorkingGroupReportSoftwarePageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Working group report SSHOC resources"),
	});
}

export default async function DashboardReportingWorkingGroupReportSoftwarePage(
	props: Readonly<DashboardReportingWorkingGroupReportSoftwarePageProps>,
): Promise<ReactNode> {
	const { year: routeYear, slug } = await props.params;
	const id = await resolveWorkingGroupReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <WorkingGroupReportSoftwareScreen reportId={id} />;
}
