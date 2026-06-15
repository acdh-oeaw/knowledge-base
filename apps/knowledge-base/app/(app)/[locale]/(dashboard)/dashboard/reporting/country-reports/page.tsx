import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportsListPage } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_components/country-reports-list-page";
import { assertAuthenticated } from "@/lib/auth/session";
import { getUserAllCountryReports } from "@/lib/data/reporting";
import { createMetadata } from "@/lib/server/create-metadata";

export async function generateMetadata(
	_props: Readonly<Record<string, never>>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Dashboard - Country reports"),
	});

	return metadata;
}

export default async function DashboardReportingCountryReportsPage(): Promise<ReactNode> {
	const { user } = await assertAuthenticated();

	const reports = await getUserAllCountryReports(user);

	return <CountryReportsListPage reports={reports} />;
}
