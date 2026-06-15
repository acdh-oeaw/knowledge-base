import type { Metadata, ResolvingMetadata } from "next";
import { useExtracted } from "next-intl";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { Main } from "@/app/(app)/[locale]/(default)/_components/main";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardCountryReportEditStepPublicationsPageProps extends PageProps<"/[locale]/dashboard/countries/[code]/reports/[year]/edit/publications"> {}

export async function generateMetadata(
	_props: Readonly<DashboardCountryReportEditStepPublicationsPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Country dashboard - Edit publications"),
	});

	return metadata;
}

export default function DashboardCountryReportEditStepPublicationsPage(
	_props: Readonly<DashboardCountryReportEditStepPublicationsPageProps>,
): ReactNode {
	const t = useExtracted();

	return (
		<Main className="container flex-1 px-8 py-12 xs:px-16">
			<section className="flex flex-col gap-y-8">
				<h1 className="text-5xl font-extrabold tracking-tight text-text-strong">
					{t("Edit publications")}
				</h1>
			</section>
		</Main>
	);
}
