import type { NextRequest } from "next/server";

import { getCountryReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { getCurrentSession } from "@/lib/auth/session";
import {
	getCountryExternalResourceSnapshots,
	getCountryReportConsortiumBranding,
} from "@/lib/data/report-marketplace-resources";

export async function GET(
	_request: NextRequest,
	{ params }: RouteContext<"/api/reporting/country-reports/[id]/download">,
): Promise<Response> {
	const { session, user } = await getCurrentSession();

	if (session == null) {
		return new Response(null, { status: 401 });
	}

	const { id } = await params;
	const result = await getCountryReportDataForUser(user, id);

	switch (result.status) {
		case "forbidden": {
			return new Response(null, { status: 403 });
		}
		case "not-found": {
			return new Response(null, { status: 404 });
		}
		case "ok": {
			const report = result.data;
			const [externalResourceSnapshots, consortium] = await Promise.all([
				getCountryExternalResourceSnapshots(report.id),
				getCountryReportConsortiumBranding(report.countryDocumentId, report.campaign.year),
			]);

			const payload = {
				id: report.id,
				status: report.status,
				generatedAt: new Date().toISOString(),
				country: report.country.name,
				consortium:
					consortium == null ? null : { name: consortium.name, acronym: consortium.acronym },
				campaign: report.campaign.year,
				totalContributors: report.summary.totalContributors,
				institutions: report.summary.institutions.map((i) => {
					return {
						name: i.name,
						acronym: i.acronym,
						representationTypes: i.representationTypes,
					};
				}),
				contributors: report.summary.contributions.map((c) => {
					return {
						name: c.personName,
						role: c.roleType,
						compensationRole: c.compensationRole,
						orgUnit: c.orgUnitName,
					};
				}),
				events: {
					small: report.summary.smallEvents,
					medium: report.summary.mediumEvents,
					large: report.summary.largeEvents,
					veryLarge: report.summary.veryLargeEvents,
					dariahCommissionedEvent: report.summary.dariahCommissionedEvent,
					reusableOutcomes: report.summary.reusableOutcomes,
				},
				socialMedia: report.summary.socialMediaAccounts.map((a) => {
					return {
						name: a.name,
						url: a.url,
						kpis: Object.fromEntries(
							a.kpis.filter((k) => k.value > 0).map((k) => [k.kpi, k.value]),
						),
					};
				}),
				services: report.summary.services.map((s) => {
					return {
						name: s.name,
						costBucket: s.costBucket,
						kpis: Object.fromEntries(
							s.kpis.filter((k) => k.value > 0).map((k) => [k.kpi, k.value]),
						),
					};
				}),
				projectContributions: report.summary.projectContributions.map((p) => {
					return { project: p.projectName, amountEuros: p.amountEuros };
				}),
				operationalCost: {
					total: report.summary.operationalCost.total,
					threshold: report.summary.operationalCost.threshold,
					lines: report.summary.operationalCost.lines.map((line) => {
						return {
							key: line.key,
							label: line.label,
							bucket: line.bucket ?? null,
							quantity: line.quantity,
							showQuantity: line.showQuantity,
							unitAmount: line.unitAmount,
							total: line.total,
						};
					}),
				},
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
					"Content-Disposition": `attachment; filename="country-report-${id}.json"`,
					"Content-Type": "application/json",
				},
			});
		}
	}
}
