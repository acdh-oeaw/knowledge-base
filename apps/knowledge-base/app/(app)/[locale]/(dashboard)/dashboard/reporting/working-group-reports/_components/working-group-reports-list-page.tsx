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
import type { WorkingGroupReportHistoryItem } from "@/lib/data/reporting";

interface WorkingGroupReportsListPageProps {
	isAdmin: boolean;
	reports: Array<WorkingGroupReportHistoryItem>;
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

export async function WorkingGroupReportsListPage(
	props: Readonly<WorkingGroupReportsListPageProps>,
): Promise<ReactNode> {
	const { isAdmin, reports } = props;

	const t = await getExtracted();

	return (
		<Fragment>
			<Header>
				<HeaderContent>
					<HeaderTitle>{t("Working group reports")}</HeaderTitle>
					<HeaderDescription>{t("View and manage your working group reports.")}</HeaderDescription>
				</HeaderContent>
			</Header>

			{reports.length === 0 ? (
				<EmptyState
					description={t("No working group reports are available for your account.")}
					title={t("No reports found")}
				/>
			) : (
				<ul className="mx-(--layout-padding) divide-y rounded-lg border">
					{reports.map((report) => {
						// Mirrors `isReportEditable` (lib/auth/permissions): admins always; otherwise
						// only while the report is a `draft` and its campaign is `open`.
						const isEditable =
							isAdmin || (report.reportStatus === "draft" && report.campaignStatus === "open");

						return (
							<li
								key={report.reportId}
								className="flex items-center justify-between gap-x-4 px-4 py-3"
							>
								<div className="flex flex-col gap-y-0.5">
									<span className="text-sm font-medium">{report.workingGroupName}</span>
									<span className="text-xs text-muted-fg">
										{report.campaignYear} &middot; {formatStatus(report.reportStatus)}
									</span>
								</div>
								<div className="flex items-center gap-x-2">
									<ButtonLink href={report.reportHref} intent="plain" size="sm">
										{t("View")}
									</ButtonLink>
									{isEditable ? (
										<ButtonLink href={`${report.reportHref}/edit`} intent="plain" size="sm">
											{t("Edit")}
										</ButtonLink>
									) : null}
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</Fragment>
	);
}
