import { ButtonLink } from "@dariah-eric/ui/button-link";
import { EmptyState } from "@dariah-eric/ui/empty-state";
import { getExtracted } from "next-intl/server";
import { Fragment, type ReactNode } from "react";

import {
	Header,
	HeaderContent,
	HeaderDescription,
	HeaderTitle,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/header";
import type { CountryReportHistoryItem } from "@/lib/data/reporting";

interface CountryReportsListPageProps {
	reports: Array<CountryReportHistoryItem>;
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export async function CountryReportsListPage(
	props: Readonly<CountryReportsListPageProps>,
): Promise<ReactNode> {
	const { reports } = props;

	const t = await getExtracted();

	return (
		<Fragment>
			<Header>
				<HeaderContent>
					<HeaderTitle>{t("Country reports")}</HeaderTitle>
					<HeaderDescription>{t("View and manage your country reports.")}</HeaderDescription>
				</HeaderContent>
			</Header>

			{reports.length === 0 ? (
				<EmptyState
					description={t("No country reports are available for your account.")}
					title={t("No reports found")}
				/>
			) : (
				<ul className="divide-y rounded-lg border mx-(--layout-padding)">
					{reports.map((report) => {
						const isEditable = report.campaignStatus === "open";

						return (
							<li
								key={report.reportId}
								className="flex items-center justify-between gap-x-4 px-4 py-3"
							>
								<div className="flex flex-col gap-y-0.5">
									<span className="text-sm font-medium">{report.countryName}</span>
									<span className="text-xs text-muted-fg">
										{report.campaignYear} &middot; {formatStatus(report.reportStatus)}
									</span>
								</div>
								<ButtonLink
									href={isEditable ? `/edit` : report.reportHref}
									intent="plain"
									size="sm"
								>
									{isEditable ? t("Edit") : t("View")}
								</ButtonLink>
							</li>
						);
					})}
				</ul>
			)}
		</Fragment>
	);
}
