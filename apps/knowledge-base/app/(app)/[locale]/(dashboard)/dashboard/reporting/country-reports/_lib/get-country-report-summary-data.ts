import { assert } from "@acdh-oeaw/lib";
import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";

import { type Action, can } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { alias, eq, sql } from "@/lib/db/sql";

export interface CountryReportSummaryData {
	totalContributors: number | null;
	smallEvents: number | null;
	mediumEvents: number | null;
	largeEvents: number | null;
	veryLargeEvents: number | null;
	dariahCommissionedEvent: string | null;
	reusableOutcomes: string | null;
	institutions: Array<{
		id: string;
		name: string;
		acronym: string | null;
		representationType: string | null;
	}>;
	contributions: Array<{
		id: string;
		personName: string;
		orgUnitName: string;
		roleType: string;
	}>;
	socialMediaAccounts: Array<{
		socialMediaId: string;
		name: string;
		url: string;
		kpis: Array<{ kpi: string; value: number }>;
	}>;
	services: Array<{
		serviceId: string;
		name: string;
		kpis: Array<{ kpi: string; value: number }>;
	}>;
	projectContributions: Array<{
		id: string;
		projectName: string;
		amountEuros: number;
	}>;
}

export interface CountryReportData {
	id: string;
	status: string;
	country: { name: string };
	campaign: { year: number; status: string };
	summary: CountryReportSummaryData;
}

export interface CountryReportHeaderData {
	id: string;
	country: { name: string };
	campaign: { year: number };
}

export type AuthorizedCountryReportResult<T> =
	| { status: "forbidden" | "not-found" }
	| { status: "ok"; data: T };

async function getCountryReportData(id: string): Promise<CountryReportData | null> {
	const report = await db.query.countryReports.findFirst({
		where: { id },
		columns: {
			id: true,
			status: true,
			totalContributors: true,
			smallEvents: true,
			mediumEvents: true,
			largeEvents: true,
			veryLargeEvents: true,
			dariahCommissionedEvent: true,
			reusableOutcomes: true,
		},
		with: {
			campaign: { columns: { year: true, status: true } },
			country: { columns: { name: true } },
			institutions: {
				columns: { id: true, representationType: true },
				with: {
					organisationalUnit: { columns: { name: true, acronym: true } },
				},
				orderBy: { organisationalUnitDocumentId: "asc" },
			},
			socialMediaKpis: {
				columns: { socialMediaId: true, kpi: true, value: true },
				with: {
					socialMedia: { columns: { name: true, url: true } },
				},
			},
			serviceKpis: {
				columns: { serviceId: true, kpi: true, value: true },
				with: {
					service: { columns: { name: true } },
				},
			},
			projectContributions: {
				columns: { id: true, amountEuros: true },
				with: {
					project: { columns: { name: true } },
				},
				orderBy: { projectDocumentId: "asc" },
			},
		},
	});

	if (report == null) {
		return null;
	}

	// Claimed contributions are document-level person↔org relations; resolve each endpoint to its
	// latest editable version for display.
	const personDocumentLifecycle = alias(schema.documentLifecycle, "person_document_lifecycle");
	const organisationalUnitDocumentLifecycle = alias(
		schema.documentLifecycle,
		"organisational_unit_document_lifecycle",
	);
	const reportContributions = await db
		.select({
			id: schema.countryReportContributions.id,
			personName: schema.persons.name,
			orgUnitName: schema.organisationalUnits.name,
			roleType: schema.personRoleTypes.type,
		})
		.from(schema.countryReportContributions)
		.innerJoin(
			schema.personsToOrganisationalUnits,
			eq(
				schema.personsToOrganisationalUnits.id,
				schema.countryReportContributions.personToOrgUnitId,
			),
		)
		.innerJoin(
			personDocumentLifecycle,
			eq(personDocumentLifecycle.documentId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${personDocumentLifecycle.draftId}, ${personDocumentLifecycle.publishedId})`,
		)
		.innerJoin(
			organisationalUnitDocumentLifecycle,
			eq(
				organisationalUnitDocumentLifecycle.documentId,
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${organisationalUnitDocumentLifecycle.draftId}, ${organisationalUnitDocumentLifecycle.publishedId})`,
		)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.where(eq(schema.countryReportContributions.countryReportId, id));

	const socialMediaMap = new Map<
		string,
		{ name: string; url: string; kpis: Array<{ kpi: string; value: number }> }
	>();
	for (const row of report.socialMediaKpis) {
		const existing = socialMediaMap.get(row.socialMediaId);
		if (existing == null) {
			socialMediaMap.set(row.socialMediaId, {
				name: row.socialMedia.name,
				url: row.socialMedia.url,
				kpis: [{ kpi: row.kpi, value: row.value }],
			});
		} else {
			existing.kpis.push({ kpi: row.kpi, value: row.value });
		}
	}

	const serviceMap = new Map<
		string,
		{ name: string; kpis: Array<{ kpi: string; value: number }> }
	>();
	for (const row of report.serviceKpis) {
		const existing = serviceMap.get(row.serviceId);
		if (existing == null) {
			serviceMap.set(row.serviceId, {
				name: row.service.name,
				kpis: [{ kpi: row.kpi, value: row.value }],
			});
		} else {
			existing.kpis.push({ kpi: row.kpi, value: row.value });
		}
	}

	// A country report always references a published country.
	assert(report.country, "Country report is missing its published country.");

	return {
		id: report.id,
		status: report.status,
		country: report.country,
		campaign: report.campaign,
		summary: {
			totalContributors: report.totalContributors,
			smallEvents: report.smallEvents,
			mediumEvents: report.mediumEvents,
			largeEvents: report.largeEvents,
			veryLargeEvents: report.veryLargeEvents,
			dariahCommissionedEvent: report.dariahCommissionedEvent,
			reusableOutcomes: report.reusableOutcomes,
			institutions: report.institutions.map((i) => {
				return {
					id: i.id,
					name: i.organisationalUnit?.name ?? "",
					acronym: i.organisationalUnit?.acronym ?? null,
					representationType: i.representationType,
				};
			}),
			contributions: reportContributions,
			socialMediaAccounts: Array.from(socialMediaMap.entries()).map(([socialMediaId, data]) => {
				return { socialMediaId, ...data };
			}),
			services: Array.from(serviceMap.entries()).map(([serviceId, data]) => {
				return { serviceId, ...data };
			}),
			projectContributions: report.projectContributions.map((p) => {
				return {
					id: p.id,
					projectName: p.project?.name ?? "",
					amountEuros: p.amountEuros,
				};
			}),
		},
	};
}

async function getCountryReportHeader(id: string): Promise<CountryReportHeaderData | null> {
	const report = await db.query.countryReports.findFirst({
		where: { id },
		columns: { id: true },
		with: {
			campaign: { columns: { year: true } },
			country: { columns: { name: true } },
		},
	});

	if (report == null) {
		return null;
	}

	// A country report always references a published country.
	assert(report.country, "Country report is missing its published country.");

	return {
		id: report.id,
		country: report.country,
		campaign: report.campaign,
	};
}

export async function getCountryReportDataForUser(
	user: User,
	id: string,
	action: Extract<Action, "read" | "update"> = "read",
): Promise<AuthorizedCountryReportResult<CountryReportData>> {
	return getAuthorizedCountryReportForUser(user, id, getCountryReportData, action);
}

export async function getCountryReportHeaderForUser(
	user: User,
	id: string,
	action: Extract<Action, "read" | "update"> = "read",
): Promise<AuthorizedCountryReportResult<CountryReportHeaderData>> {
	return getAuthorizedCountryReportForUser(user, id, getCountryReportHeader, action);
}

export async function getAuthorizedCountryReportForUser<T>(
	user: User,
	id: string,
	load: (id: string) => Promise<T | null>,
	action: Extract<Action, "read" | "update"> = "read",
): Promise<AuthorizedCountryReportResult<T>> {
	const header = await getCountryReportHeader(id);

	if (header == null) {
		return { status: "not-found" };
	}

	const allowed = await can(user, action, { type: "country_report", id });

	if (!allowed) {
		return { status: "forbidden" };
	}

	const report = await load(id);

	if (report == null) {
		return { status: "not-found" };
	}

	return { status: "ok", data: report };
}
