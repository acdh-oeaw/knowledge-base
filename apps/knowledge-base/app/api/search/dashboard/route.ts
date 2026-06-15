import * as schema from "@acdh-knowledge-base/database/schema";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/session";
import { getUserAllCountryReports, getUserAllWorkingGroupReports } from "@/lib/data/reporting";
import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { alias, and, desc, eq, or, sql } from "@/lib/db/sql";
import { enforceApiGetRateLimit } from "@/lib/server/api-rate-limit";

interface DashboardSearchResult {
	id: string;
	type: "person" | "project" | "organisational-unit" | "website-content" | "report";
	label: string;
	description: string;
	href: string;
}

const organisationalUnitTypeHrefs: Record<string, string> = {
	country: "/dashboard/administrator/countries",
	governance_body: "/dashboard/administrator/governance-bodies",
	institution: "/dashboard/administrator/institutions",
	national_consortium: "/dashboard/administrator/national-consortia",
	working_group: "/dashboard/administrator/working-groups",
};

function formatOrganisationalUnitType(type: string): string {
	return type.replaceAll("_", " ");
}

function normalizeSearchValue(value: string): string {
	return value.normalize("NFD").replaceAll(/\p{M}/gu, "").toLocaleLowerCase();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
	const rateLimitResponse = await enforceApiGetRateLimit();
	if (rateLimitResponse != null) {
		return rateLimitResponse;
	}

	const { session, user } = await getCurrentSession();

	if (session == null) {
		return new NextResponse(null, { status: 401 });
	}

	const { searchParams } = request.nextUrl;
	const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 8), 1), 20);
	const query = searchParams.get("q")?.trim();

	if (query == null || query.length < 2) {
		return NextResponse.json({ items: [] satisfies Array<DashboardSearchResult> });
	}

	const [
		persons,
		projects,
		organisationalUnits,
		pages,
		spotlightArticles,
		impactCaseStudies,
		news,
		events,
		opportunities,
		fundingCalls,
		documentsPolicies,
		reports,
	] = await Promise.all([
		user.role === "admin" ? searchPersons(query, limit) : [],
		user.role === "admin" ? searchProjects(query, limit) : [],
		user.role === "admin" ? searchOrganisationalUnits(query, limit) : [],
		user.role === "admin" ? searchPages(query, limit) : [],
		user.role === "admin" ? searchSpotlightArticles(query, limit) : [],
		user.role === "admin" ? searchImpactCaseStudies(query, limit) : [],
		user.role === "admin" ? searchNews(query, limit) : [],
		user.role === "admin" ? searchEvents(query, limit) : [],
		user.role === "admin" ? searchOpportunities(query, limit) : [],
		user.role === "admin" ? searchFundingCalls(query, limit) : [],
		user.role === "admin" ? searchDocumentsPolicies(query, limit) : [],
		searchReports(user, query, limit),
	]);

	return NextResponse.json({
		items: [
			...reports,
			...persons,
			...projects,
			...organisationalUnits,
			...pages,
			...spotlightArticles,
			...impactCaseStudies,
			...news,
			...events,
			...opportunities,
			...fundingCalls,
			...documentsPolicies,
		].slice(0, limit),
	});
}

async function searchReports(
	user: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>["user"]>,
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	if (user.role === "admin") {
		const [countryReports, workingGroupReports] = await Promise.all([
			searchCountryReportsForAdmin(query, limit),
			searchWorkingGroupReportsForAdmin(query, limit),
		]);

		return [...countryReports, ...workingGroupReports].slice(0, limit);
	}

	const [countryReports, workingGroupReports] = await Promise.all([
		getUserAllCountryReports(user),
		getUserAllWorkingGroupReports(user),
	]);
	const normalizedQuery = normalizeSearchValue(query);

	return [
		...countryReports.flatMap((report) => {
			const label = `${report.countryName} ${report.campaignYear}`;

			if (!normalizeSearchValue(label).includes(normalizedQuery)) {
				return [];
			}

			return {
				id: report.reportId,
				type: "report" as const,
				label,
				description: "Country report",
				href: report.reportHref,
			};
		}),
		...workingGroupReports.flatMap((report) => {
			const label = `${report.workingGroupName} ${report.campaignYear}`;

			if (!normalizeSearchValue(label).includes(normalizedQuery)) {
				return [];
			}

			return {
				id: report.reportId,
				type: "report" as const,
				label,
				description: "Working group report",
				href: report.reportHref,
			};
		}),
	].slice(0, limit);
}

async function searchCountryReportsForAdmin(
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	const countryReportLifecycle = alias(
		schema.documentLifecycle,
		"dashboard_search_country_report_lifecycle",
	);
	const pickedVersion = sql`COALESCE(${countryReportLifecycle.draftId}, ${countryReportLifecycle.publishedId})`;

	const rows = await db
		.select({
			id: schema.countryReports.id,
			year: schema.reportingCampaigns.year,
			countryName: schema.organisationalUnits.name,
		})
		.from(schema.countryReports)
		.innerJoin(
			schema.reportingCampaigns,
			eq(schema.reportingCampaigns.id, schema.countryReports.campaignId),
		)
		.innerJoin(
			countryReportLifecycle,
			eq(countryReportLifecycle.documentId, schema.countryReports.countryDocumentId),
		)
		.innerJoin(schema.organisationalUnits, sql`${schema.organisationalUnits.id} = ${pickedVersion}`)
		.where(
			or(
				unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
				sql<boolean>`${schema.reportingCampaigns.year}::text ilike ${`%${query}%`}`,
			),
		)
		.orderBy(desc(schema.reportingCampaigns.year), schema.organisationalUnits.name)
		.limit(limit);

	return rows.map((report) => {
		return {
			id: report.id,
			type: "report",
			label: `${report.countryName} ${report.year}`,
			description: "Country report",
			href: `/dashboard/administrator/country-reports/${report.id}`,
		};
	});
}

async function searchWorkingGroupReportsForAdmin(
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	const workingGroupReportLifecycle = alias(
		schema.documentLifecycle,
		"dashboard_search_working_group_report_lifecycle",
	);
	const pickedVersion = sql`COALESCE(${workingGroupReportLifecycle.draftId}, ${workingGroupReportLifecycle.publishedId})`;

	const rows = await db
		.select({
			id: schema.workingGroupReports.id,
			year: schema.reportingCampaigns.year,
			workingGroupName: schema.organisationalUnits.name,
		})
		.from(schema.workingGroupReports)
		.innerJoin(
			schema.reportingCampaigns,
			eq(schema.reportingCampaigns.id, schema.workingGroupReports.campaignId),
		)
		.innerJoin(
			workingGroupReportLifecycle,
			eq(workingGroupReportLifecycle.documentId, schema.workingGroupReports.workingGroupDocumentId),
		)
		.innerJoin(schema.organisationalUnits, sql`${schema.organisationalUnits.id} = ${pickedVersion}`)
		.where(
			or(
				unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
				sql<boolean>`${schema.reportingCampaigns.year}::text ilike ${`%${query}%`}`,
			),
		)
		.orderBy(desc(schema.reportingCampaigns.year), schema.organisationalUnits.name)
		.limit(limit);

	return rows.map((report) => {
		return {
			id: report.id,
			type: "report",
			label: `${report.workingGroupName} ${report.year}`,
			description: "Working group report",
			href: `/dashboard/administrator/working-group-reports/${report.id}`,
		};
	});
}

async function searchPersons(query: string, limit: number): Promise<Array<DashboardSearchResult>> {
	const personEntities = alias(schema.entities, "dashboard_search_person_entities");
	const personLifecycle = alias(schema.documentLifecycle, "dashboard_search_person_lifecycle");
	const pickedVersion = sql`COALESCE(${personLifecycle.draftId}, ${personLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: personEntities.id,
			slug: personEntities.slug,
			name: schema.persons.name,
			sortName: schema.persons.sortName,
		})
		.from(personEntities)
		.innerJoin(personLifecycle, eq(personLifecycle.documentId, personEntities.id))
		.innerJoin(schema.persons, sql`${schema.persons.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.persons.name, `%${query}%`))
		.orderBy(schema.persons.sortName)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "person",
			label: item.name,
			description: "Person",
			href: `/dashboard/administrator/persons/${item.slug}/edit`,
		};
	});
}

async function searchPages(query: string, limit: number): Promise<Array<DashboardSearchResult>> {
	const pageEntities = alias(schema.entities, "dashboard_search_page_entities");
	const pageLifecycle = alias(schema.documentLifecycle, "dashboard_search_page_lifecycle");
	const pickedVersion = sql`COALESCE(${pageLifecycle.draftId}, ${pageLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: pageEntities.id,
			slug: pageEntities.slug,
			title: schema.pages.title,
		})
		.from(pageEntities)
		.innerJoin(pageLifecycle, eq(pageLifecycle.documentId, pageEntities.id))
		.innerJoin(schema.pages, sql`${schema.pages.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.pages.title, `%${query}%`))
		.orderBy(schema.pages.title)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "website-content",
			label: item.title,
			description: "Page",
			href: `/dashboard/website/pages/${item.slug}/edit`,
		};
	});
}

async function searchSpotlightArticles(
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	const spotlightEntities = alias(schema.entities, "dashboard_search_spotlight_entities");
	const spotlightLifecycle = alias(
		schema.documentLifecycle,
		"dashboard_search_spotlight_lifecycle",
	);
	const pickedVersion = sql`COALESCE(${spotlightLifecycle.draftId}, ${spotlightLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: spotlightEntities.id,
			slug: spotlightEntities.slug,
			title: schema.spotlightArticles.title,
		})
		.from(spotlightEntities)
		.innerJoin(spotlightLifecycle, eq(spotlightLifecycle.documentId, spotlightEntities.id))
		.innerJoin(schema.spotlightArticles, sql`${schema.spotlightArticles.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.spotlightArticles.title, `%${query}%`))
		.orderBy(schema.spotlightArticles.title)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "website-content",
			label: item.title,
			description: "Spotlight article",
			href: `/dashboard/website/spotlight-articles/${item.slug}/edit`,
		};
	});
}

async function searchImpactCaseStudies(
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	const impactEntities = alias(schema.entities, "dashboard_search_impact_entities");
	const impactLifecycle = alias(schema.documentLifecycle, "dashboard_search_impact_lifecycle");
	const pickedVersion = sql`COALESCE(${impactLifecycle.draftId}, ${impactLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: impactEntities.id,
			slug: impactEntities.slug,
			title: schema.impactCaseStudies.title,
		})
		.from(impactEntities)
		.innerJoin(impactLifecycle, eq(impactLifecycle.documentId, impactEntities.id))
		.innerJoin(schema.impactCaseStudies, sql`${schema.impactCaseStudies.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.impactCaseStudies.title, `%${query}%`))
		.orderBy(schema.impactCaseStudies.title)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "website-content",
			label: item.title,
			description: "Impact case study",
			href: `/dashboard/website/impact-case-studies/${item.slug}/edit`,
		};
	});
}

async function searchNews(query: string, limit: number): Promise<Array<DashboardSearchResult>> {
	const newsEntities = alias(schema.entities, "dashboard_search_news_entities");
	const newsLifecycle = alias(schema.documentLifecycle, "dashboard_search_news_lifecycle");
	const pickedVersion = sql`COALESCE(${newsLifecycle.draftId}, ${newsLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: newsEntities.id,
			slug: newsEntities.slug,
			title: schema.news.title,
		})
		.from(newsEntities)
		.innerJoin(newsLifecycle, eq(newsLifecycle.documentId, newsEntities.id))
		.innerJoin(schema.news, sql`${schema.news.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.news.title, `%${query}%`))
		.orderBy(schema.news.title)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "website-content",
			label: item.title,
			description: "News",
			href: `/dashboard/website/news/${item.slug}/edit`,
		};
	});
}

async function searchEvents(query: string, limit: number): Promise<Array<DashboardSearchResult>> {
	const eventEntities = alias(schema.entities, "dashboard_search_event_entities");
	const eventLifecycle = alias(schema.documentLifecycle, "dashboard_search_event_lifecycle");
	const pickedVersion = sql`COALESCE(${eventLifecycle.draftId}, ${eventLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: eventEntities.id,
			slug: eventEntities.slug,
			title: schema.events.title,
		})
		.from(eventEntities)
		.innerJoin(eventLifecycle, eq(eventLifecycle.documentId, eventEntities.id))
		.innerJoin(schema.events, sql`${schema.events.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.events.title, `%${query}%`))
		.orderBy(schema.events.title)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "website-content",
			label: item.title,
			description: "Event",
			href: `/dashboard/website/events/${item.slug}/edit`,
		};
	});
}

async function searchOpportunities(
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	const opportunityEntities = alias(schema.entities, "dashboard_search_opportunity_entities");
	const opportunityLifecycle = alias(
		schema.documentLifecycle,
		"dashboard_search_opportunity_lifecycle",
	);
	const pickedVersion = sql`COALESCE(${opportunityLifecycle.draftId}, ${opportunityLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: opportunityEntities.id,
			slug: opportunityEntities.slug,
			title: schema.opportunities.title,
		})
		.from(opportunityEntities)
		.innerJoin(opportunityLifecycle, eq(opportunityLifecycle.documentId, opportunityEntities.id))
		.innerJoin(schema.opportunities, sql`${schema.opportunities.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.opportunities.title, `%${query}%`))
		.orderBy(schema.opportunities.title)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "website-content",
			label: item.title,
			description: "Opportunity",
			href: `/dashboard/website/opportunities/${item.slug}/edit`,
		};
	});
}

async function searchFundingCalls(
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	const fundingCallEntities = alias(schema.entities, "dashboard_search_funding_call_entities");
	const fundingCallLifecycle = alias(
		schema.documentLifecycle,
		"dashboard_search_funding_call_lifecycle",
	);
	const pickedVersion = sql`COALESCE(${fundingCallLifecycle.draftId}, ${fundingCallLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: fundingCallEntities.id,
			slug: fundingCallEntities.slug,
			title: schema.fundingCalls.title,
		})
		.from(fundingCallEntities)
		.innerJoin(fundingCallLifecycle, eq(fundingCallLifecycle.documentId, fundingCallEntities.id))
		.innerJoin(schema.fundingCalls, sql`${schema.fundingCalls.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.fundingCalls.title, `%${query}%`))
		.orderBy(schema.fundingCalls.title)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "website-content",
			label: item.title,
			description: "Funding call",
			href: `/dashboard/website/funding-calls/${item.slug}/edit`,
		};
	});
}

async function searchDocumentsPolicies(
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	const documentEntities = alias(schema.entities, "dashboard_search_document_entities");
	const documentLifecycle = alias(schema.documentLifecycle, "dashboard_search_document_lifecycle");
	const pickedVersion = sql`COALESCE(${documentLifecycle.draftId}, ${documentLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: documentEntities.id,
			slug: documentEntities.slug,
			title: schema.documentsPolicies.title,
		})
		.from(documentEntities)
		.innerJoin(documentLifecycle, eq(documentLifecycle.documentId, documentEntities.id))
		.innerJoin(schema.documentsPolicies, sql`${schema.documentsPolicies.id} = ${pickedVersion}`)
		.where(unaccentIlike(schema.documentsPolicies.title, `%${query}%`))
		.orderBy(schema.documentsPolicies.title)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "website-content",
			label: item.title,
			description: "Document or policy",
			href: `/dashboard/website/documents-policies/${item.slug}/edit`,
		};
	});
}

async function searchProjects(query: string, limit: number): Promise<Array<DashboardSearchResult>> {
	const projectEntities = alias(schema.entities, "dashboard_search_project_entities");
	const projectLifecycle = alias(schema.documentLifecycle, "dashboard_search_project_lifecycle");
	const pickedVersion = sql`COALESCE(${projectLifecycle.draftId}, ${projectLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: projectEntities.id,
			slug: projectEntities.slug,
			name: schema.projects.name,
			acronym: schema.projects.acronym,
		})
		.from(projectEntities)
		.innerJoin(projectLifecycle, eq(projectLifecycle.documentId, projectEntities.id))
		.innerJoin(schema.projects, sql`${schema.projects.id} = ${pickedVersion}`)
		.where(
			or(
				unaccentIlike(schema.projects.name, `%${query}%`),
				unaccentIlike(schema.projects.acronym, `%${query}%`),
			),
		)
		.orderBy(schema.projects.name)
		.limit(limit);

	return rows.map((item) => {
		return {
			id: item.documentId,
			type: "project",
			label: item.acronym ?? item.name,
			description: item.acronym != null ? `Project: ${item.name}` : "Project",
			href: `/dashboard/administrator/projects/${item.slug}/edit`,
		};
	});
}

async function searchOrganisationalUnits(
	query: string,
	limit: number,
): Promise<Array<DashboardSearchResult>> {
	const unitEntities = alias(schema.entities, "dashboard_search_unit_entities");
	const unitLifecycle = alias(schema.documentLifecycle, "dashboard_search_unit_lifecycle");
	const pickedVersion = sql`COALESCE(${unitLifecycle.draftId}, ${unitLifecycle.publishedId})`;

	const rows = await db
		.select({
			documentId: unitEntities.id,
			slug: unitEntities.slug,
			name: schema.organisationalUnits.name,
			acronym: schema.organisationalUnits.acronym,
			type: schema.organisationalUnitTypes.type,
		})
		.from(unitEntities)
		.innerJoin(unitLifecycle, eq(unitLifecycle.documentId, unitEntities.id))
		.innerJoin(schema.organisationalUnits, sql`${schema.organisationalUnits.id} = ${pickedVersion}`)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(
			and(
				sql`${unitLifecycle.draftId} IS NOT NULL OR ${unitLifecycle.publishedId} IS NOT NULL`,
				or(
					unaccentIlike(schema.organisationalUnits.name, `%${query}%`),
					unaccentIlike(schema.organisationalUnits.acronym, `%${query}%`),
				),
			),
		)
		.orderBy(schema.organisationalUnits.name)
		.limit(limit);

	return rows.flatMap((item) => {
		const baseHref = organisationalUnitTypeHrefs[item.type];

		if (baseHref == null) {
			return [];
		}

		return {
			id: item.documentId,
			type: "organisational-unit",
			label: item.acronym ?? item.name,
			description:
				item.acronym != null
					? `${formatOrganisationalUnitType(item.type)}: ${item.name}`
					: formatOrganisationalUnitType(item.type),
			href: `${baseHref}/${item.slug}/edit`,
		};
	});
}
