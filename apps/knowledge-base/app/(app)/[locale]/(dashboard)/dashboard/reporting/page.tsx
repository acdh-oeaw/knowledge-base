import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted, getLocale } from "next-intl/server";
import type { ReactNode } from "react";

import { ReportingOverviewPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/reporting-overview-page";
import { assertAuthenticated } from "@/lib/auth/session";
import { getUserReportingScope } from "@/lib/data/reporting";
import { redirect } from "@/lib/navigation/navigation";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingPageProps extends PageProps<"/[locale]/dashboard/reporting"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Dashboard - Reporting"),
	});

	return metadata;
}

export default async function DashboardReportingPage(
	_props: Readonly<DashboardReportingPageProps>,
): Promise<ReactNode> {
	const { user } = await assertAuthenticated();

	if (user.role === "admin") {
		redirect({ href: "/dashboard/reporting/administrator", locale: await getLocale() });
	}

	const scope = await getUserReportingScope(user);

	return <ReportingOverviewPage scope={scope} />;
}
