import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { CountryReportCreateForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/country-reports/_components/country-report-create-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCountryReportCreateDataForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorCreateCountryReportPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/create"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorCreateCountryReportPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - New country report"),
	});

	return metadata;
}

export default async function DashboardAdministratorCreateCountryReportPage(
	_props: Readonly<DashboardAdministratorCreateCountryReportPageProps>,
): Promise<ReactNode> {
	const { user } = await assertAuthenticated();
	const { campaigns, countries } = await getCountryReportCreateDataForAdmin(user);

	return <CountryReportCreateForm campaigns={campaigns} countries={countries} />;
}
