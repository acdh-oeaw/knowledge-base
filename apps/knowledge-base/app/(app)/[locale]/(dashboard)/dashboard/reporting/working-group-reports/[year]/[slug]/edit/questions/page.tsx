import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { WorkingGroupReportQuestionsScreen } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_components/screens/working-group-report-questions-screen";
import { resolveWorkingGroupReportId } from "@/lib/data/reporting-urls";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingWorkingGroupReportQuestionsPageProps extends PageProps<"/[locale]/dashboard/reporting/working-group-reports/[year]/[slug]/edit/questions"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingWorkingGroupReportQuestionsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	return createMetadata(resolvingMetadata, {
		title: t("Dashboard - Working group report questions"),
	});
}

export default async function DashboardReportingWorkingGroupReportQuestionsPage(
	props: Readonly<DashboardReportingWorkingGroupReportQuestionsPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { year: routeYear, slug } = await params;
	const id = await resolveWorkingGroupReportId({ year: routeYear, slug });

	if (id == null) {
		notFound();
	}

	return <WorkingGroupReportQuestionsScreen reportId={id} />;
}
