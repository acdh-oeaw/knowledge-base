import { ButtonLink } from "@dariah-eric/ui/button-link";
import type { Metadata, ResolvingMetadata } from "next";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import { assertAdminPageAccess } from "@/lib/auth/session";
import { createMetadata } from "@/lib/server/create-metadata";

interface DashboardReportingAdministratorPageProps extends PageProps<"/[locale]/dashboard/reporting/administrator"> {}

export async function generateMetadata(
	_props: Readonly<DashboardReportingAdministratorPageProps>,
	resolvingMetadata: ResolvingMetadata,
): Promise<Metadata> {
	const t = await getExtracted();

	const metadata: Metadata = await createMetadata(resolvingMetadata, {
		title: t("Dashboard - Reporting"),
	});

	return metadata;
}

export default async function DashboardReportingAdministratorPage(
	_props: Readonly<DashboardReportingAdministratorPageProps>,
): Promise<ReactNode> {
	await assertAdminPageAccess();

	const t = await getExtracted();

	const items = [
		{
			href: "/dashboard/administrator/reporting-campaigns",
			title: t("Reporting campaigns"),
			description: t("Configure campaigns, questions, thresholds, and lifecycle settings."),
		},
		{
			href: "/dashboard/administrator/reporting-statistics",
			title: t("Statistics"),
			description: t("View reporting statistics and summary metrics across campaigns."),
		},
		{
			href: "/dashboard/administrator/country-reports",
			title: t("Country reports"),
			description: t("Review and manage all country reports across campaigns."),
		},
		{
			href: "/dashboard/administrator/working-group-reports",
			title: t("Working group reports"),
			description: t("Review and manage all working group reports across campaigns."),
		},
	];

	return (
		<div className="flex flex-col gap-y-8">
			<Header>
				<HeaderContent>
					<HeaderTitle>{t("Reporting")}</HeaderTitle>
					<HeaderDescription>
						{t("Manage reporting operations, campaigns, and report collections.")}
					</HeaderDescription>
				</HeaderContent>
			</Header>

			<div className="grid gap-4 px-(--layout-padding) pbs-2 md:grid-cols-4">
				{items.map((item) => (
					<section
						key={item.href}
						className="flex flex-col justify-between gap-y-4 rounded-lg border bg-bg p-4"
					>
						<div className="flex flex-col gap-y-1">
							<h2 className="font-medium text-sm text-fg">{item.title}</h2>
							<p className="text-sm text-muted-fg">{item.description}</p>
						</div>

						<ButtonLink href={item.href} intent="outline" size="sm">
							{t("Open")}
						</ButtonLink>
					</section>
				))}
			</div>
		</div>
	);
}
