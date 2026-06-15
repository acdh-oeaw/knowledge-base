import type { NextRequest } from "next/server";

import { getWorkingGroupReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { richTextToText } from "@/app/api/reporting/_lib/rich-text-to-text";
import { type PdfSection, createTextPdf } from "@/app/api/reporting/_lib/text-pdf";
import { getCurrentSession } from "@/lib/auth/session";

function value(value: number | string | null): string {
	return value == null || value === "" ? "-" : String(value);
}

function formatRole(role: string): string {
	return role
		.replaceAll("_", " ")
		.replace(/^is /, "")
		.replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

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
			const sections: Array<PdfSection> = [
				{
					title: "Overview",
					lines: [
						`Working group: ${report.workingGroup.name}`,
						`Campaign: ${report.campaign.year}`,
						`Status: ${report.status}`,
					],
				},
				{
					title: "Working group data",
					lines: [
						`Number of members: ${value(report.summary.numberOfMembers)}`,
						`Mailing list: ${value(report.summary.mailingList)}`,
					],
				},
				{
					title: "Chairs",
					lines:
						report.summary.chairs.length > 0
							? report.summary.chairs.map((c) => `${c.personName} - ${formatRole(c.roleType)}`)
							: ["No chairs recorded."],
				},
				{
					title: "Social media",
					lines:
						report.summary.socialMedia.length > 0
							? report.summary.socialMedia.map(
									(item) => `${item.socialMedia.name} - ${item.socialMedia.url}`,
								)
							: ["No social media recorded."],
				},
				{
					title: "Events",
					lines:
						report.summary.events.length > 0
							? report.summary.events.map((event) => {
									const date = dateFormatter.format(new Date(event.date));
									const url = event.url == null ? "" : ` - ${event.url}`;

									return `${event.title} - ${date} - ${event.role}${url}`;
								})
							: ["No events recorded."],
				},
				{
					title: "Questions",
					lines:
						report.summary.questions.length > 0
							? report.summary.questions.flatMap((question) => [
									`Question: ${richTextToText(question.question)}`,
									`Answer: ${richTextToText(question.answer) || "No answer provided."}`,
								])
							: ["No questions recorded."],
				},
			];
			const pdf = await createTextPdf(
				`Working group report - ${report.workingGroup.name}`,
				sections,
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
