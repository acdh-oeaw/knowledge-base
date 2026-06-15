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

interface DashboardCountryReportsPageProps extends PageProps<"/[locale]/dashboard/countries/[code]/reports"> {}

export async function generateMetadata(
	_props: Readonly<DashboardCountryReportsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Country dashboard - Reports"),
	});

	return metadata;
}

export default function DashboardCountryReportsPage(
	_props: Readonly<DashboardCountryReportsPageProps>,
): ReactNode {
	const t = useExtracted();

	return (
		<Header>
			<HeaderContent>
				<HeaderTitle>{t("Reports")}</HeaderTitle>
				<HeaderDescription>{t("Manage country reports.")}</HeaderDescription>
			</HeaderContent>
		</Header>
	);
}
