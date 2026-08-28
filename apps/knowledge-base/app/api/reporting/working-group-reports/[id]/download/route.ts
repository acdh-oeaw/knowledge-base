import type { NextRequest } from "next/server";

import { getWorkingGroupReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/working-group-reports/_lib/get-working-group-report-summary-data";
import { getCurrentSession } from "@/lib/auth/session";
import {
	getWorkingGroupBranding,
	getWorkingGroupExternalResourceSnapshots,
} from "@/lib/data/report-marketplace-resources";

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
			const [externalResourceSnapshots, branding] = await Promise.all([
				getWorkingGroupExternalResourceSnapshots(report.id),
				getWorkingGroupBranding(report.workingGroupDocumentId),
			]);

			const payload = {
				id: report.id,
				status: report.status,
				generatedAt: new Date().toISOString(),
				workingGroup: report.workingGroup.name,
				workingGroupAcronym: branding?.acronym ?? null,
				campaign: report.campaign.year,
				numberOfMembers: report.summary.numberOfMembers,
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
				externalResources: externalResourceSnapshots.map((snapshot) => {
					return {
						section: snapshot.section,
						capturedAt: snapshot.capturedAt.toISOString(),
						capturedBy: snapshot.capturedByUserName,
						filterBy: snapshot.filterBy,
						actorSlugs: snapshot.actorSlugs,
						items: snapshot.items.map((item) => {
							return {
								source: item.source,
								sourceId: item.sourceId,
								sourceUpdatedAt: item.sourceUpdatedAt,
								importedAt: item.importedAt,
								type: item.type,
								sshocCategory: item.sshocCategory,
								label: item.label,
								description: item.description,
								keywords: item.keywords,
								kind: item.kind,
								sourceUrl: item.sourceUrl,
								links: item.links,
								authors: item.authors,
								year: item.year,
								pid: item.pid,
							};
						}),
					};
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
