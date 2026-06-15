import type { JSONContent } from "@tiptap/core";
import { getExtracted } from "next-intl/server";
import type { ReactNode } from "react";

import { RichTextView } from "@/app/(app)/[locale]/(dashboard)/dashboard/_components/rich-text-view";

export interface WorkingGroupReportSummaryData {
	numberOfMembers: number | null;
	mailingList: string | null;
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
}

function formatRole(role: string): string {
	return role
		.replaceAll("_", " ")
		.replace(/^is /, "")
		.replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export async function WorkingGroupReportSummary(
	props: Readonly<WorkingGroupReportSummaryProps>,
): Promise<ReactNode> {
	const { data } = props;

	const t = await getExtracted();

	return (
		<div className="flex flex-col gap-y-10">
			<section className="flex flex-col gap-y-4">
				<h2 className="text-sm font-semibold text-fg">{t("Working group data")}</h2>
				<dl className="grid max-inline-sm grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
					<dt className="text-muted-fg">{t("Number of members")}</dt>
					<dd>{data.numberOfMembers ?? "—"}</dd>
					<dt className="text-muted-fg">{t("Mailing list")}</dt>
					<dd>
						{data.mailingList != null ? (
							<a className="underline" href={data.mailingList} rel="noreferrer" target="_blank">
								{data.mailingList}
							</a>
						) : (
							"—"
						)}
					</dd>
				</dl>
			</section>

			{data.chairs.length > 0 && (
				<section className="flex flex-col gap-y-4">
					<h2 className="text-sm font-semibold text-fg">{t("Chairs")}</h2>
					<ul className="max-inline-sm divide-y rounded-md border">
						{data.chairs.map((chair) => (
							<li key={chair.id} className="px-4 py-3">
								<p className="text-sm font-medium text-fg">{chair.personName}</p>
								<p className="text-xs text-muted-fg">{formatRole(chair.roleType)}</p>
							</li>
						))}
					</ul>
				</section>
			)}

			{data.socialMedia.length > 0 && (
				<section className="flex flex-col gap-y-4">
					<h2 className="text-sm font-semibold text-fg">{t("Social media")}</h2>
					<ul className="max-inline-sm divide-y rounded-md border">
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
				</section>
			)}

			{data.events.length > 0 && (
				<section className="flex flex-col gap-y-4">
					<h2 className="text-sm font-semibold text-fg">{t("Events")}</h2>
					<ul className="divide-y rounded-md border">
						{data.events.map((event) => (
							<li key={event.id} className="flex items-center justify-between gap-x-4 px-4 py-3">
								<div className="flex flex-col gap-y-0.5">
									<span className="text-sm font-medium text-fg">{event.title}</span>
									<span className="text-xs text-muted-fg">
										{dateFormatter.format(new Date(event.date))}
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
				</section>
			)}

			{data.questions.length > 0 && (
				<section className="flex flex-col gap-y-6">
					<h2 className="text-sm font-semibold text-fg">{t("Questions")}</h2>
					{data.questions.map((q) => (
						<div key={q.id} className="flex flex-col gap-y-3">
							<div className="rounded-md border border-border bg-muted/30 p-4">
								<RichTextView ariaLabel={t("Question")} content={q.question} />
							</div>
							{q.answer != null ? (
								<div className="px-4">
									<RichTextView ariaLabel={t("Answer")} content={q.answer} />
								</div>
							) : (
								<p className="px-4 text-sm text-muted-fg">{t("No answer provided.")}</p>
							)}
						</div>
					))}
				</section>
			)}
		</div>
	);
}
