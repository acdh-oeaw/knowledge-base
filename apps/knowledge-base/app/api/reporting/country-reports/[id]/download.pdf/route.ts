import type { NextRequest } from "next/server";

import { getCountryReportDataForUser } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
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

function formatKpi(kpi: string): string {
	return kpi.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

const eurFormatter = new Intl.NumberFormat("en", {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
});

export async function GET(
	_request: NextRequest,
	{ params }: RouteContext<"/api/reporting/country-reports/[id]/download.pdf">,
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
			const sections: Array<PdfSection> = [
				{
					title: "Overview",
					lines: [
						`Country: ${report.country.name}`,
						`Campaign: ${report.campaign.year}`,
						`Status: ${report.status}`,
					],
				},
				{
					title: "Institutions",
					lines:
						report.summary.institutions.length > 0
							? report.summary.institutions.map((i) => {
									const label = i.acronym == null ? i.name : `${i.name} (${i.acronym})`;
									return i.representationType == null
										? label
										: `${label} - ${formatRole(i.representationType)}`;
								})
							: ["No institutions recorded."],
				},
				{
					title: "Contributors",
					lines: [
						`Total contributors: ${value(report.summary.totalContributors)}`,
						...report.summary.contributions.map(
							(c) => `${c.personName} - ${formatRole(c.roleType)} - ${c.orgUnitName}`,
						),
					],
				},
				{
					title: "Events",
					lines: [
						`Small: ${value(report.summary.smallEvents)}`,
						`Medium: ${value(report.summary.mediumEvents)}`,
						`Large: ${value(report.summary.largeEvents)}`,
						`Very large: ${value(report.summary.veryLargeEvents)}`,
						`DARIAH commissioned event: ${value(report.summary.dariahCommissionedEvent)}`,
						`Reusable outcomes: ${value(report.summary.reusableOutcomes)}`,
					],
				},
				{
					title: "Social media",
					lines:
						report.summary.socialMediaAccounts.length > 0
							? report.summary.socialMediaAccounts.flatMap((account) => {
									const kpis = account.kpis
										.filter((kpi) => kpi.value > 0)
										.map((kpi) => `${formatKpi(kpi.kpi)}: ${kpi.value}`)
										.join(", ");

									return [
										`${account.name} - ${account.url}`,
										kpis.length > 0 ? kpis : "No KPIs recorded.",
									];
								})
							: ["No social media recorded."],
				},
				{
					title: "Services",
					lines:
						report.summary.services.length > 0
							? report.summary.services.flatMap((service) => {
									const kpis = service.kpis
										.filter((kpi) => kpi.value > 0)
										.map((kpi) => `${formatKpi(kpi.kpi)}: ${kpi.value}`)
										.join(", ");

									return [service.name, kpis.length > 0 ? kpis : "No KPIs recorded."];
								})
							: ["No services recorded."],
				},
				{
					title: "Project contributions",
					lines:
						report.summary.projectContributions.length > 0
							? report.summary.projectContributions.map(
									(p) => `${p.projectName}: ${eurFormatter.format(p.amountEuros)}`,
								)
							: ["No project contributions recorded."],
				},
			];
			const pdf = await createTextPdf(`Country report - ${report.country.name}`, sections);

			return new Response(pdf, {
				headers: {
					"Content-Disposition": `attachment; filename="country-report-${id}.pdf"`,
					"Content-Type": "application/pdf",
				},
			});
		}
	}
}
