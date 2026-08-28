import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { ReportExternalResourcesSnapshotSection } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-external-resources-snapshot-section";
import type { ReportSummarySectionLink } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-summary-section";
import { refreshCountryReportExternalResourceSnapshotAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/refresh-country-report-external-resource-snapshot.action";
import { refreshWorkingGroupReportExternalResourceSnapshotAction } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/refresh-working-group-report-external-resource-snapshot.action";
import {
	type ReportExternalResourceSnapshot,
	type ReportExternalResourceSnapshotSection,
	getCountryExternalResourceSnapshot,
	getWorkingGroupExternalResourceSnapshot,
} from "@/lib/data/report-marketplace-resources";
import type { ServerAction } from "@/lib/server/create-server-action";

type LiveResourceKind = "country" | "workingGroup";

/** Stable anchor ids for the external-data sections, shared with the "On this page" nav. */
export const liveReportSoftwareSectionId = "live-report-software";
export const liveReportPublicationsSectionId = "live-report-publications";

interface LiveSectionDescriptor {
	description: string;
	emptyMessage: string;
	id: string;
	section: ReportExternalResourceSnapshotSection;
	title: string;
}

interface LiveReportResourcesProps {
	reportId: string;
	reportKind: LiveResourceKind;
}

async function getLiveSectionDescriptors(
	reportKind: LiveResourceKind,
): Promise<Array<LiveSectionDescriptor>> {
	const t = await getExtracted();

	if (reportKind === "country") {
		return [
			{
				description: t(
					"Stored SSH Open Marketplace resources for this report. Refresh to capture the current search-index results.",
				),
				emptyMessage: t("No SSH Open Marketplace resources snapshot has been captured yet."),
				id: liveReportSoftwareSectionId,
				section: "country_sshoc_resources",
				title: t("SSHOC resources"),
			},
			{
				description: t(
					"Stored Zotero publications for this report. Refresh to capture the current search-index results.",
				),
				emptyMessage: t("No Zotero publications snapshot has been captured yet."),
				id: liveReportPublicationsSectionId,
				section: "country_zotero_publications",
				title: t("Zotero publications"),
			},
		];
	}

	return [
		{
			description: t(
				"Stored SSH Open Marketplace resources for this report. Refresh to capture the current search-index results.",
			),
			emptyMessage: t("No SSH Open Marketplace resources snapshot has been captured yet."),
			id: liveReportSoftwareSectionId,
			section: "working_group_sshoc_resources",
			title: t("SSHOC resources"),
		},
		{
			description: t(
				"Stored Zotero publications for this report. Refresh to capture the current search-index results.",
			),
			emptyMessage: t("No Zotero publications snapshot has been captured yet."),
			id: liveReportPublicationsSectionId,
			section: "working_group_zotero_publications",
			title: t("Zotero publications"),
		},
	];
}

export async function getLiveReportResourceNavLinks(
	reportKind: LiveResourceKind,
): Promise<Array<ReportSummarySectionLink>> {
	const descriptors = await getLiveSectionDescriptors(reportKind);

	return descriptors.map((descriptor) => {
		return { id: descriptor.id, label: descriptor.title };
	});
}

async function getSnapshot(
	reportId: string,
	descriptor: LiveSectionDescriptor,
): Promise<ReportExternalResourceSnapshot | null> {
	switch (descriptor.section) {
		case "country_sshoc_resources":
		case "country_zotero_publications": {
			return getCountryExternalResourceSnapshot(reportId, descriptor.section);
		}
		case "working_group_sshoc_resources":
		case "working_group_zotero_publications": {
			return getWorkingGroupExternalResourceSnapshot(reportId, descriptor.section);
		}
	}

	return null;
}

function getRefreshAction(reportKind: LiveResourceKind): ServerAction {
	return reportKind === "country"
		? refreshCountryReportExternalResourceSnapshotAction
		: refreshWorkingGroupReportExternalResourceSnapshotAction;
}

export async function LiveReportResources(
	props: Readonly<LiveReportResourcesProps>,
): Promise<ReactNode> {
	const { reportId, reportKind } = props;
	const t = await getExtracted();
	const descriptors = await getLiveSectionDescriptors(reportKind);
	const snapshots = await Promise.all(
		descriptors.map(
			async (descriptor) => [descriptor.section, await getSnapshot(reportId, descriptor)] as const,
		),
	);
	const snapshotsBySection = new Map(snapshots);

	return (
		<section className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-1">
				<h2 className="text-sm font-semibold text-fg">{t("External data snapshots")}</h2>
				<p className="text-sm text-muted-fg">
					{t(
						"These stored snapshots are used for historical report exports. Refresh a section to capture current external search-index data.",
					)}
				</p>
			</div>

			<div className="flex flex-col gap-y-8">
				{descriptors.map((descriptor) => {
					const snapshot = snapshotsBySection.get(descriptor.section) ?? null;

					return (
						<ReportExternalResourcesSnapshotSection
							key={descriptor.section}
							canRefresh={true}
							capturedAt={snapshot?.capturedAt.toISOString() ?? null}
							capturedByUserName={snapshot?.capturedByUserName ?? null}
							description={descriptor.description}
							emptyMessage={
								snapshot == null
									? descriptor.emptyMessage
									: t("No external resources recorded for this snapshot.")
							}
							items={snapshot?.items ?? []}
							refreshAction={getRefreshAction(reportKind)}
							reportId={reportId}
							reportIdFieldName={
								reportKind === "country" ? "countryReportId" : "workingGroupReportId"
							}
							section={descriptor.section}
							sectionId={descriptor.id}
							title={descriptor.title}
						/>
					);
				})}
			</div>
		</section>
	);
}

export function LiveReportResourcesFallback(
	props: Readonly<{ description: string; loadingLabel: string; title: string }>,
): ReactNode {
	return (
		<section className="flex flex-col gap-y-4">
			<div className="flex flex-col gap-y-1">
				<h2 className="text-sm font-semibold text-fg">{props.title}</h2>
				<p className="text-sm text-muted-fg">{props.description}</p>
			</div>
			<p className="text-sm text-muted-fg">{props.loadingLabel}</p>
		</section>
	);
}
