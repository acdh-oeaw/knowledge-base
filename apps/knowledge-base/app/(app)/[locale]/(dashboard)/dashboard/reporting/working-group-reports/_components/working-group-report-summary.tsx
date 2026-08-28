import type { JSONContent } from "@tiptap/core";
import { getExtracted, getFormatter } from "next-intl/server";
import type { ReactNode } from "react";

import { RichTextView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-view";
import {
	ReportSummaryNav,
	ReportSummarySection,
	type ReportSummarySectionLink,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/_components/report-summary-section";

export interface WorkingGroupReportSummaryData {
	numberOfMembers: number | null;
	chairs: Array<{ id: string; personName: string; roleType: string }>;
	socialMedia: Array<{
		id: string;
		socialMedia: { name: string; url: string };
	}>;
	events: Array<{
		id: string;
		title: string;
		date: Date;
		url: string | null;
		role: string;
	}>;
	questions: Array<{
		id: string;
		question: JSONContent;
		answer: JSONContent | null;
	}>;
}

interface WorkingGroupReportSummaryProps {
	data: WorkingGroupReportSummaryData;
	/**
	 * Additional "On this page" nav links for sections rendered as siblings of this summary (e.g. the
	 * admin "External data snapshots" block). Appended after the stored-data sections.
	 */
	extraSectionLinks?: ReadonlyArray<ReportSummarySectionLink>;
}

function formatRole(role: string): string {
	return role
		.replaceAll("_", " ")
		.replace(/^is /, "")
		.replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

export async function WorkingGroupReportSummary(
	props: Readonly<WorkingGroupReportSummaryProps>,
): Promise<ReactNode> {
	const { data, extraSectionLinks } = props;

	const t = await getExtracted();
	// Inherits the app's global `timeZone: "UTC"`, so stored event dates never shift by timezone.
	const format = await getFormatter();

	const dataLabel = t("Working group data");
	const chairsLabel = t("Chairs");
	const socialMediaLabel = t("Social media");
	const eventsLabel = t("Events");
	const questionsLabel = t("Questions");

	const sectionLinks: Array<ReportSummarySectionLink> = [
		{ id: "working-group-report-data", label: dataLabel },
	];

	if (data.chairs.length > 0) {
		sectionLinks.push({ id: "working-group-report-chairs", label: chairsLabel });
	}

	if (data.socialMedia.length > 0) {
		sectionLinks.push({ id: "working-group-report-social-media", label: socialMediaLabel });
	}

	if (data.events.length > 0) {
		sectionLinks.push({ id: "working-group-report-events", label: eventsLabel });
	}

	if (data.questions.length > 0) {
		sectionLinks.push({ id: "working-group-report-questions", label: questionsLabel });
	}

	if (extraSectionLinks != null) {
		sectionLinks.push(...extraSectionLinks);
	}

	return (
		<div className="flex flex-col gap-y-8 max-inline-4xl">
			<ReportSummaryNav
				aria-label={t("Report sections")}
				links={sectionLinks}
				title={t("On this page")}
			/>

			<div className="flex flex-col">
				<ReportSummarySection id="working-group-report-data" title={dataLabel}>
					<dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm max-inline-sm">
						<dt className="text-muted-fg">{t("Number of members")}</dt>
						<dd>{data.numberOfMembers ?? "—"}</dd>
					</dl>
				</ReportSummarySection>

				{data.chairs.length > 0 && (
					<ReportSummarySection id="working-group-report-chairs" title={chairsLabel}>
						<ul className="divide-y rounded-md border max-inline-sm">
							{data.chairs.map((chair) => (
								<li key={chair.id} className="px-4 py-3">
									<p className="text-sm font-medium text-fg">{chair.personName}</p>
									<p className="text-xs text-muted-fg">{formatRole(chair.roleType)}</p>
								</li>
							))}
						</ul>
					</ReportSummarySection>
				)}

				{data.socialMedia.length > 0 && (
					<ReportSummarySection id="working-group-report-social-media" title={socialMediaLabel}>
						<ul className="divide-y rounded-md border max-inline-sm">
							{data.socialMedia.map((item) => (
								<li key={item.id} className="px-4 py-3">
									<p className="text-sm font-medium text-fg">{item.socialMedia.name}</p>
									<a
										className="text-xs text-muted-fg underline"
										href={item.socialMedia.url}
										rel="noreferrer"
										target="_blank"
									>
										{item.socialMedia.url}
									</a>
								</li>
							))}
						</ul>
					</ReportSummarySection>
				)}

				{data.events.length > 0 && (
					<ReportSummarySection id="working-group-report-events" title={eventsLabel}>
						<ul className="divide-y rounded-md border">
							{data.events.map((event) => (
								<li key={event.id} className="flex items-center justify-between gap-x-4 px-4 py-3">
									<div className="flex flex-col gap-y-0.5">
										<span className="text-sm font-medium text-fg">{event.title}</span>
										<span className="text-xs text-muted-fg">
											{format.dateTime(new Date(event.date), { dateStyle: "medium" })}
											{" · "}
											<span className="capitalize">{event.role}</span>
										</span>
									</div>
									{event.url != null && (
										<a
											className="shrink-0 text-xs text-muted-fg underline"
											href={event.url}
											rel="noreferrer"
											target="_blank"
										>
											{t("Link")}
										</a>
									)}
								</li>
							))}
						</ul>
					</ReportSummarySection>
				)}

				{data.questions.length > 0 && (
					<ReportSummarySection
						contentClassName="gap-y-6"
						id="working-group-report-questions"
						title={questionsLabel}
					>
						{data.questions.map((q) => (
							<div key={q.id} className="flex flex-col gap-y-3">
								<div className="rounded-md border border-border bg-muted/30 p-4">
									<RichTextView ariaLabel={t("Question")} content={q.question} size="sm" />
								</div>
								{q.answer != null ? (
									<div className="px-4">
										<RichTextView ariaLabel={t("Answer")} content={q.answer} size="sm" />
									</div>
								) : (
									<p className="px-4 text-sm text-muted-fg">{t("No answer provided.")}</p>
								)}
							</div>
						))}
					</ReportSummarySection>
				)}
			</div>
		</div>
	);
}
