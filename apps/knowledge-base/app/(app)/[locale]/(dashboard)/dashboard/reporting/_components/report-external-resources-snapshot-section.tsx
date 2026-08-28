"use client";

import { createActionStateInitial } from "@dariah-eric/next-lib/actions";
import { Badge } from "@dariah-eric/ui/badge";
import { Button } from "@dariah-eric/ui/button";
import { Form } from "@dariah-eric/ui/form";
import { FormStatus } from "@dariah-eric/ui/form-status";
import { ProgressCircle } from "@dariah-eric/ui/progress-circle";
import { useExtracted } from "next-intl";
import { Fragment, type ReactNode, useActionState } from "react";

import type {
	ReportExternalResourceSnapshotItem,
	ReportExternalResourceSnapshotSection,
} from "@/lib/data/report-marketplace-resources";
import type { ServerAction } from "@/lib/server/create-server-action";

interface ReportExternalResourcesSnapshotSectionProps {
	canRefresh: boolean;
	capturedAt: string | null;
	capturedByUserName: string | null;
	description: string;
	emptyMessage: string;
	items: Array<ReportExternalResourceSnapshotItem>;
	refreshAction: ServerAction;
	reportId: string;
	reportIdFieldName: "countryReportId" | "workingGroupReportId";
	section: ReportExternalResourceSnapshotSection;
	sectionId?: string;
	title: string;
}

function formatDate(value: string): string {
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function getItemMeta(item: ReportExternalResourceSnapshotItem): Array<string> {
	return [
		item.sshocCategory,
		item.sshocCategory == null ? item.source : null,
		item.sshocCategory == null ? item.type : null,
		item.year == null ? null : String(item.year),
		item.kind,
	].filter((value): value is string => value != null && value !== "");
}

export function ReportExternalResourcesSnapshotSection(
	props: Readonly<ReportExternalResourcesSnapshotSectionProps>,
): ReactNode {
	const {
		canRefresh,
		capturedAt,
		capturedByUserName,
		description,
		emptyMessage,
		items,
		refreshAction,
		reportId,
		reportIdFieldName,
		section,
		sectionId,
		title,
	} = props;

	const t = useExtracted();
	const [state, action, isPending] = useActionState(refreshAction, createActionStateInitial());

	return (
		<section className="flex scroll-mbs-24 flex-col gap-y-4" id={sectionId}>
			<div className="flex flex-col gap-y-1">
				<h2 className="text-sm font-semibold text-fg">{title}</h2>
				<p className="text-sm text-muted-fg max-inline-md">{description}</p>
				{capturedAt == null ? (
					<Badge className="self-start" intent="warning">
						{t("No snapshot captured")}
					</Badge>
				) : (
					<p className="text-xs text-muted-fg">
						{capturedByUserName == null
							? t("Snapshot refreshed {date}.", { date: formatDate(capturedAt) })
							: t("Snapshot refreshed {date} by {name}.", {
									date: formatDate(capturedAt),
									name: capturedByUserName,
								})}
					</p>
				)}
			</div>

			{items.length > 0 ? (
				<ul className="flex flex-col gap-y-3">
					{items.map((item) => (
						<li key={item.id} className="rounded-md border border-border p-4">
							<div className="flex flex-col gap-y-2">
								{(item.sourceUrl ?? item.links[0]) != null ? (
									<a
										className="text-sm font-semibold text-fg underline-offset-4 hover:underline"
										href={item.sourceUrl ?? item.links[0]}
										rel="noreferrer"
										target="_blank"
									>
										{item.label}
									</a>
								) : (
									<p className="text-sm font-semibold text-fg">{item.label}</p>
								)}
								<p className="text-xs text-muted-fg">{getItemMeta(item).join(" - ")}</p>
								{item.authors != null && item.authors.length > 0 ? (
									<p className="text-xs text-muted-fg">{item.authors.join(", ")}</p>
								) : null}
								{item.description !== "" ? (
									<p className="line-clamp-3 text-sm text-muted-fg">{item.description}</p>
								) : null}
								{item.pid != null ? (
									<p className="text-xs text-muted-fg">{t("DOI: {doi}", { doi: item.pid })}</p>
								) : null}
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="text-sm text-muted-fg italic">{emptyMessage}</p>
			)}

			{canRefresh ? (
				<Form action={action} className="flex flex-col gap-y-3 max-inline-sm" state={state}>
					<input name={reportIdFieldName} type="hidden" value={reportId} />
					<input name="section" type="hidden" value={section} />
					<Button className="self-start" isPending={isPending} type="submit">
						{isPending ? (
							<Fragment>
								<ProgressCircle aria-label={t("Refreshing...")} isIndeterminate={true} />
								<span aria-hidden={true}>{t("Refreshing...")}</span>
							</Fragment>
						) : capturedAt == null ? (
							t("Capture snapshot")
						) : (
							t("Refresh snapshot")
						)}
					</Button>
					<FormStatus className="self-start" state={state} />
				</Form>
			) : null}
		</section>
	);
}
