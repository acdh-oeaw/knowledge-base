import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CountryReportEditForm } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/country-reports/_components/country-report-edit-form";
import { assertAuthenticated } from "@/lib/auth/session";
import { getCountryReportForAdmin } from "@/lib/data/admin-reporting";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardAdministratorEditCountryReportPageProps extends PageProps<"/[locale]/dashboard/administrator/country-reports/[id]/edit"> {}

export async function generateMetadata(
	_props: Readonly<DashboardAdministratorEditCountryReportPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Administrator dashboard - Edit country report"),
	});

	return metadata;
}

export default async function DashboardAdministratorEditCountryReportPage(
	props: Readonly<DashboardAdministratorEditCountryReportPageProps>,
): Promise<ReactNode> {
	const { params } = props;

	const { id } = await params;

	const { user } = await assertAuthenticated();
	const report = await getCountryReportForAdmin(user, id);

	if (report == null) {
		notFound();
	}

	return <CountryReportEditForm report={report} />;
}
