import type { NextRequest } from "next/server";

import { getCountryReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { getCurrentSession } from "@/lib/auth/session";

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

			const payload = {
				id: report.id,
				status: report.status,
				country: report.country.name,
				campaign: report.campaign.year,
				totalContributors: report.summary.totalContributors,
				institutions: report.summary.institutions.map((i) => {
					return { name: i.name, acronym: i.acronym, representationType: i.representationType };
				}),
				contributors: report.summary.contributions.map((c) => {
					return { name: c.personName, role: c.roleType, orgUnit: c.orgUnitName };
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
						kpis: Object.fromEntries(
							s.kpis.filter((k) => k.value > 0).map((k) => [k.kpi, k.value]),
						),
					};
				}),
				projectContributions: report.summary.projectContributions.map((p) => {
					return { project: p.projectName, amountEuros: p.amountEuros };
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
