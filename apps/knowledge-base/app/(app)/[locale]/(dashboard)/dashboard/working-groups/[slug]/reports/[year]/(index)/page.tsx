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

interface DashboardWorkingGroupReportPageProps extends PageProps<"/[locale]/dashboard/working-groups/[slug]/reports/[year]"> {}

export async function generateMetadata(
	_props: Readonly<DashboardWorkingGroupReportPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Working group dashboard - Report"),
	});

	return metadata;
}

export default function DashboardWorkingGroupReportPage(
	_props: Readonly<DashboardWorkingGroupReportPageProps>,
): ReactNode {
	const t = useExtracted();

	return (
		<Header>
			<HeaderContent>
				<HeaderTitle>{t("Report")}</HeaderTitle>
				<HeaderDescription>{t("Manage working group report.")}</HeaderDescription>
			</HeaderContent>
		</Header>
	);
}
