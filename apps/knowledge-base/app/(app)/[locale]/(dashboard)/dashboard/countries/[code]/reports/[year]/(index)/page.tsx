import type { Metadata, ResolvingMetadata } from "next";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardCountryReportPageProps extends PageProps<"/[locale]/dashboard/countries/[code]/reports/[year]"> {}

export async function generateMetadata(
	_props: Readonly<DashboardCountryReportPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Country dashboard - Report"),
	});

	return metadata;
}

export default function DashboardCountryReportPage(
	_props: Readonly<DashboardCountryReportPageProps>,
): ReactNode {
	const t = useExtracted();

	return (
		<Header>
			<HeaderContent>
				<HeaderTitle>{t("Report")}</HeaderTitle>
				<HeaderDescription>{t("Manage country report.")}</HeaderDescription>
			</HeaderContent>
		</Header>
	);
}
