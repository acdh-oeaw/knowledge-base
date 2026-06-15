import type { NextRequest } from "next/server";

import { getWorkingGroupReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { getCurrentSession } from "@/lib/auth/session";

export async function GET(
	_request: NextRequest,
	{ params }: RouteContext<"/api/reporting/working-group-reports/[id]/download">,
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

			const payload = {
				id: report.id,
				status: report.status,
				workingGroup: report.workingGroup.name,
				campaign: report.campaign.year,
				numberOfMembers: report.summary.numberOfMembers,
				mailingList: report.summary.mailingList,
				chairs: report.summary.chairs.map((c) => {
					return { name: c.personName, role: c.roleType };
				}),
				socialMedia: report.summary.socialMedia.map((s) => {
					return { name: s.socialMedia.name, url: s.socialMedia.url };
				}),
				events: report.summary.events.map((e) => {
					return { title: e.title, date: e.date, url: e.url, role: e.role };
				}),
				questions: report.summary.questions.map((q) => {
					return { question: q.question, answer: q.answer };
				}),
			};

			return new Response(JSON.stringify(payload, null, 2), {
				headers: {
					"Content-Disposition": `attachment; filename="working-group-report-${id}.json"`,
					"Content-Type": "application/json",
				},
			});
		}
	}
}
