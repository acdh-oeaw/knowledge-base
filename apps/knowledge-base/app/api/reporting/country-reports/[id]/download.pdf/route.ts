import type { NextRequest } from "next/server";

import {
	formatContributorOrgUnit,
	getCountryReportDataForUser,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/get-country-report-summary-data";
import { fetchBrandLogo } from "@/app/api/reporting/_lib/report-logo";
import { type ReportBlock, createReportPdf } from "@/app/api/reporting/_lib/report-pdf";
import { getCurrentSession } from "@/lib/auth/session";
import { formatCountryReportInstitutionRepresentationType } from "@/lib/data/country-report-institutions";
import {
	type ReportExternalResourceSnapshot,
	getCountryExternalResourceSnapshots,
	getCountryReportConsortiumBranding,
} from "@/lib/data/report-marketplace-resources";

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

function formatKpi(kpi: string): string {
	return kpi.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

function formatExternalSectionTitle(section: string): string {
	return section.replaceAll("_", " ").replaceAll(/\b\w/g, (c) => c.toUpperCase());
}

function formatOperationalCostLabel(label: string): string {
	const separatorIndex = label.indexOf(": ");
	if (separatorIndex === -1) {
		return label;
	}

	const prefix = label.slice(0, separatorIndex);
	const suffix = label.slice(separatorIndex + 2);

	return `${prefix}: ${formatRole(suffix)}`;
}

const eurFormatter = new Intl.NumberFormat("en", {
	style: "currency",
	currency: "EUR",
	maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

function externalResourceSnapshotBlocks(
	snapshot: ReportExternalResourceSnapshot,
): Array<ReportBlock> {
	const captured = dateFormatter.format(snapshot.capturedAt);

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
			const summary = report.summary;

			const [externalResourceSnapshots, consortium] = await Promise.all([
				getCountryExternalResourceSnapshots(report.id),
				getCountryReportConsortiumBranding(report.countryDocumentId, report.campaign.year),
			]);
			const logoPng = await fetchBrandLogo(consortium?.imageKey ?? null);

			// Contributors
			const blocks: Array<ReportBlock> = [{ kind: "heading", text: "Contributors" }];
			if (summary.contributions.length > 0) {
				blocks.push({
					kind: "itemList",
					items: summary.contributions.map((c) => {
						return {
							primary: c.personName,
							secondary: `${formatRole(c.roleType)} · ${formatContributorOrgUnit(c.orgUnitName, c.orgUnitType)}`,
						};
					}),
				});
			}
			blocks.push({
				kind: "definitionList",
				rows: [{ label: "Total contributors", value: value(summary.totalContributors) }],
			});

			// Institutions
			blocks.push({ kind: "heading", text: "Institutions" });
			if (summary.institutions.length > 0) {
				blocks.push({
					kind: "itemList",
					items: summary.institutions.map((i) => {
						const primary = i.acronym == null ? i.name : `${i.name} (${i.acronym})`;
						const representationTypes = i.representationTypes
							.map(formatCountryReportInstitutionRepresentationType)
							.join(", ");

						return {
							primary,
							secondary: representationTypes === "" ? undefined : representationTypes,
						};
					}),
				});
			}
			blocks.push({
				kind: "definitionList",
				rows: [
					{ label: "Number of institutions", value: summary.institutions.length.toLocaleString() },
				],
			});

			// Events
			const hasEvents =
				summary.smallEvents != null ||
				summary.mediumEvents != null ||
				summary.largeEvents != null ||
				summary.veryLargeEvents != null ||
				summary.dariahCommissionedEvent != null ||
				summary.reusableOutcomes != null;
			if (hasEvents) {
				const rows = [
					{ label: "Small", value: value(summary.smallEvents) },
					{ label: "Medium", value: value(summary.mediumEvents) },
					{ label: "Large", value: value(summary.largeEvents) },
					{ label: "Very large", value: value(summary.veryLargeEvents) },
				];
				if (summary.dariahCommissionedEvent != null) {
					rows.push({
						label: "DARIAH commissioned event",
						value: summary.dariahCommissionedEvent,
					});
				}
				if (summary.reusableOutcomes != null) {
					rows.push({ label: "Reusable outcomes", value: summary.reusableOutcomes });
				}
				blocks.push({ kind: "heading", text: "Events" });
				blocks.push({ kind: "definitionList", rows });
			}

			// Social media
			if (summary.socialMediaAccounts.length > 0) {
				blocks.push({ kind: "heading", text: "Social media" });
				blocks.push({
					kind: "cards",
					cards: summary.socialMediaAccounts.map((account) => {
						return {
							title: account.name,
							subtitle: account.url,
							kpis: account.kpis
								.filter((kpi) => kpi.value > 0)
								.map((kpi) => {
									return { label: formatKpi(kpi.kpi), value: kpi.value.toLocaleString() };
								}),
							emptyLabel: "No KPIs recorded.",
						};
					}),
				});
			}

			// Services
			if (summary.services.length > 0) {
				blocks.push({ kind: "heading", text: "Services" });
				blocks.push({
					kind: "cards",
					cards: summary.services.map((service) => {
						return {
							title: service.name,
							badge:
								service.costBucket == null
									? undefined
									: `Bucket: ${formatRole(service.costBucket)}`,
							kpis: service.kpis
								.filter((kpi) => kpi.value > 0)
								.map((kpi) => {
									return { label: formatKpi(kpi.kpi), value: kpi.value.toLocaleString() };
								}),
							emptyLabel: "No KPIs recorded.",
						};
					}),
				});
			}

			// Project contributions
			if (summary.projectContributions.length > 0) {
				blocks.push({ kind: "heading", text: "Project contributions" });
				blocks.push({
					kind: "itemList",
					items: summary.projectContributions.map((p) => {
						return { primary: p.projectName, trailing: eurFormatter.format(p.amountEuros) };
					}),
				});
			}

			// External resources
			for (const snapshot of externalResourceSnapshots) {
				blocks.push(...externalResourceSnapshotBlocks(snapshot));
			}

			// Operational cost (last)
			blocks.push({ kind: "heading", text: "Operational cost" });
			blocks.push({
				kind: "costTable",
				total: {
					label: "Total operational cost",
					value: eurFormatter.format(summary.operationalCost.total),
				},
				threshold: {
					label: "Operational cost threshold",
					value:
						summary.operationalCost.threshold == null
							? "—"
							: eurFormatter.format(summary.operationalCost.threshold),
				},
				lines: summary.operationalCost.lines.map((line) => {
					const meta = [
						line.bucket == null ? null : `Bucket: ${formatRole(line.bucket)}`,
						line.showQuantity ? `Quantity: ${line.quantity.toLocaleString()}` : null,
						`Unit: ${eurFormatter.format(line.unitAmount)}`,
					]
						.filter(Boolean)
						.join(" · ");

					return {
						label: formatOperationalCostLabel(line.label),
						meta,
						total: eurFormatter.format(line.total),
					};
				}),
				emptyLabel: "No operational cost line items recorded.",
			});

			const pdf = await createReportPdf(
				{
					subject: report.country.name,
					meta: [
						`Report ${report.campaign.year}`,
						`Status: ${formatStatus(report.status)}`,
						`Generated ${dateFormatter.format(new Date())}`,
					],
					brand: {
						logoPng,
						name: consortium?.name ?? report.country.name,
						acronym: consortium?.acronym ?? null,
					},
				},
				blocks,
			);

			return new Response(pdf, {
				headers: {
					"Content-Disposition": `attachment; filename="country-report-${id}.pdf"`,
					"Content-Type": "application/pdf",
				},
			});
		}
	}
}
