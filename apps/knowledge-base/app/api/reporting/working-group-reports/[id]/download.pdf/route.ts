import { getFormatter } from "next-intl/server";
import type { NextRequest } from "next/server";

import { getWorkingGroupReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { fetchBrandLogo } from "@/app/api/reporting/_lib/report-logo";
import { type ReportBlock, createReportPdf } from "@/app/api/reporting/_lib/report-pdf";
import { richTextToText } from "@/app/api/reporting/_lib/rich-text-to-text";
import { getCurrentSession } from "@/lib/auth/session";
import {
	type ReportExternalResourceSnapshot,
	getWorkingGroupBranding,
	getWorkingGroupExternalResourceSnapshots,
} from "@/lib/data/report-marketplace-resources";
import { defaultLocale } from "@/lib/i18n/locales";

function value(value: number | string | null): string {
	return value == null || value === "" ? "—" : String(value);
}

function formatStatus(status: string): string {
	return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRole(role: string): string {
	return role
		.replaceAll("_", " ")
		.replace(/^is /, "")
		.replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

function formatExternalSectionTitle(section: string): string {
	return section.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

type Formatter = Awaited<ReturnType<typeof getFormatter>>;

function externalResourceSnapshotBlocks(
	snapshot: ReportExternalResourceSnapshot,
	format: Formatter,
): Array<ReportBlock> {
	const captured = format.dateTime(snapshot.capturedAt, { dateStyle: "medium" });

	if (snapshot.items.length === 0) {
		return [
			{ kind: "heading", text: formatExternalSectionTitle(snapshot.section) },
			{ kind: "paragraphs", paragraphs: [{ text: `Captured ${captured}`, muted: true }] },
			{
				kind: "paragraphs",
				paragraphs: [{ text: "No external resources recorded.", muted: true }],
			},
		];
	}

	return [
		{ kind: "heading", text: formatExternalSectionTitle(snapshot.section) },
		{ kind: "paragraphs", paragraphs: [{ text: `Captured ${captured}`, muted: true }] },
		{
			kind: "itemList",
			items: snapshot.items.map((item) => {
				const meta = [
					item.sshocCategory,
					item.source,
					item.year == null ? null : String(item.year),
					item.kind,
				]
					.filter(Boolean)
					.join(" · ");

				return {
					primary: item.label,
					secondary:
						[meta, item.sourceUrl ?? item.links[0]].filter(Boolean).join(" · ") || undefined,
				};
			}),
		},
	];
}

export async function GET(
	_request: NextRequest,
	{ params }: RouteContext<"/api/reporting/working-group-reports/[id]/download.pdf">,
): Promise<Response> {
	const { session, user } = await getCurrentSession();

	if (session == null) {
		return new Response(null, { status: 401 });
	}

	const { id } = await params;
	const result = await getWorkingGroupReportDataForUser(user, id);

	switch (result.status) {
		case "forbidden": {
			return new Response(null, { status: 403 });
		}
		case "not-found": {
			return new Response(null, { status: 404 });
		}
		case "ok": {
			const report = result.data;
			const summary = report.summary;

			// The PDF is a fixed-locale artifact; `getFormatter` inherits the app's `timeZone: "UTC"`
			// so stored calendar dates (e.g. event dates) render on the day they were entered.
			const format = await getFormatter({ locale: defaultLocale });

			const [externalResourceSnapshots, branding] = await Promise.all([
				getWorkingGroupExternalResourceSnapshots(report.id),
				getWorkingGroupBranding(report.workingGroupDocumentId),
			]);
			const logoPng = await fetchBrandLogo(branding?.imageKey ?? null);

			// Working group data
			const blocks: Array<ReportBlock> = [
				{ kind: "heading", text: "Working group data" },
				{
					kind: "definitionList",
					rows: [{ label: "Number of members", value: value(summary.numberOfMembers) }],
				},
			];

			// Chairs
			if (summary.chairs.length > 0) {
				blocks.push({ kind: "heading", text: "Chairs" });
				blocks.push({
					kind: "itemList",
					items: summary.chairs.map((chair) => {
						return { primary: chair.personName, secondary: formatRole(chair.roleType) };
					}),
				});
			}

			// Social media
			if (summary.socialMedia.length > 0) {
				blocks.push({ kind: "heading", text: "Social media" });
				blocks.push({
					kind: "itemList",
					items: summary.socialMedia.map((item) => {
						return { primary: item.socialMedia.name, secondary: item.socialMedia.url };
					}),
				});
			}

			// Events
			if (summary.events.length > 0) {
				blocks.push({ kind: "heading", text: "Events" });
				blocks.push({
					kind: "itemList",
					items: summary.events.map((event) => {
						const secondary = [
							format.dateTime(new Date(event.date), { dateStyle: "medium" }),
							formatRole(event.role),
							event.url,
						]
							.filter(Boolean)
							.join(" · ");

						return { primary: event.title, secondary };
					}),
				});
			}

			// Questions
			if (summary.questions.length > 0) {
				blocks.push({ kind: "heading", text: "Questions" });
				blocks.push({
					kind: "qa",
					items: summary.questions.map((question) => {
						return {
							question: richTextToText(question.question),
							answer: richTextToText(question.answer) || "No answer provided.",
						};
					}),
				});
			}

			// External resources
			for (const snapshot of externalResourceSnapshots) {
				blocks.push(...externalResourceSnapshotBlocks(snapshot, format));
			}

			const pdf = await createReportPdf(
				{
					subject: report.workingGroup.name,
					meta: [
						`Report ${report.campaign.year}`,
						`Status: ${formatStatus(report.status)}`,
						`Generated ${format.dateTime(new Date(), { dateStyle: "medium" })}`,
					],
					brand: {
						logoPng,
						name: branding?.name ?? report.workingGroup.name,
						acronym: branding?.acronym ?? null,
					},
				},
				blocks,
			);

			return new Response(pdf, {
				headers: {
					"Content-Disposition": `attachment; filename="working-group-report-${id}.pdf"`,
					"Content-Type": "application/pdf",
				},
			});
		}
	}
}
