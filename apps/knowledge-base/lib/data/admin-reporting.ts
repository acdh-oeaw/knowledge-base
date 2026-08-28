/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import { hasDariahCommissionedEvent } from "@/app/(app)/[locale]/(dashboard)/dashboard/reporting/country-reports/_lib/calculate-operational-cost";
import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { matchesAllTerms } from "@/lib/db/search";
import {
	type PgColumn,
	type PgSelect,
	type SQL,
	type SQLWrapper,
	alias,
	and,
	asc,
	count,
	desc,
	eq,
	inArray,
	sql,
} from "@/lib/db/sql";
import type { ListSortDirection } from "@/lib/server/list-search-params";

interface GetReportingListParams {
	limit: number;
	offset: number;
	q?: string;
}

type ReportingCampaignsSort = "year";
type CountryReportsSort = "campaignYear" | "country";
type WorkingGroupReportsSort = "campaignYear" | "workingGroup";

interface GetCountryReportsListParams extends GetReportingListParams {
	dir?: ListSortDirection;
	sort?: CountryReportsSort;
}

interface GetWorkingGroupReportsListParams extends GetReportingListParams {
	dir?: ListSortDirection;
	sort?: WorkingGroupReportsSort;
}

interface GetReportingCampaignsListParams extends GetReportingListParams {
	dir?: ListSortDirection;
	sort?: ReportingCampaignsSort;
}

function assertAdminUser(user: Pick<User, "role">): void {
	if (user.role !== "admin") {
		forbidden();
	}
}

export interface ReportingStatisticsOverview {
	campaignCount: number;
	totalCountryReports: number;
	totalContributors: number;
	totalCountryEvents: number;
	totalWorkingGroupEvents: number;
	/**
	 * Each country's contribution to each project, counted once across the whole range in scope.
	 *
	 * Countries re-report a project every campaign year it runs, entering the whole-duration amount
	 * each time, so adding the rows up would multiply the same money by the number of years. Where
	 * the amount changed between years, the most recent report wins. Includes every report status
	 * unless the status filter narrows it.
	 */
	totalProjectContributions: number;
	/**
	 * How many distinct country–project pairs, and how many country reports, are behind
	 * {@link totalProjectContributions}. Only country reports carry project contributions — working
	 * groups do not report projects at all — so these two say what the sum is actually made of.
	 */
	totalProjectContributionCount: number;
	countryReportsWithProjectContributions: number;
}

export interface ReportingStatisticsCampaignSummary {
	id: string;
	year: number;
	status: string;
	countryDraftCount: number;
	countrySubmittedCount: number;
	countryAcceptedCount: number;
	workingGroupDraftCount: number;
	workingGroupSubmittedCount: number;
	workingGroupAcceptedCount: number;
	totalContributors: number;
	totalCountryEvents: number;
	totalInstitutions: number;
	totalServices: number;
	totalProjectContributions: number;
	totalWorkingGroupMembers: number;
	totalWorkingGroupEvents: number;
}

export interface ReportingStatisticsCountryTrend {
	campaignYear: number;
	countryName: string;
	status: string;
	totalContributors: number;
	totalEvents: number;
	institutions: number;
	services: number;
	projectContributions: number;
	contributorsDelta: number | null;
	eventsDelta: number | null;
	projectContributionsDelta: number | null;
}

export interface ReportingStatisticsWorkingGroupYearSummary {
	campaignYear: number;
	reportCount: number;
	draftCount: number;
	submittedCount: number;
	acceptedCount: number;
	totalMembers: number;
	totalEvents: number;
	organiserEvents: number;
	presenterEvents: number;
	socialMediaAccounts: number;
}

export interface ReportingStatisticsData {
	overview: ReportingStatisticsOverview;
	campaignSummaries: Array<ReportingStatisticsCampaignSummary>;
	countryTrends: Array<ReportingStatisticsCountryTrend>;
	workingGroupYearSummaries: Array<ReportingStatisticsWorkingGroupYearSummary>;
}

export type ReportStatus = (typeof schema.reportStatusEnum)[number];

/**
 * The filters shared by every reporting-statistics tab. They live in the URL and are owned by the
 * section layout, so switching tabs keeps the current selection.
 */
export interface ReportingStatisticsFilters {
	campaignYear?: number;
	countryName?: string;
	status?: ReportStatus;
}

/**
 * Options for the shared filter bar. Deliberately independent of the active filters — the selects
 * must keep offering every year/country even once a narrower filter is applied.
 */
export interface ReportingStatisticsFilterOptions {
	campaignYears: Array<number>;
	countries: Array<string>;
}

export async function getCountryReportsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetCountryReportsListParams>,
) {
	assertAdminUser(currentUser);

	const { dir = "desc", limit, offset, q, sort = "campaignYear" } = params;
	const query = q?.trim();
	// The report's country is a document id; match it against the documents of name-matching org units.
	const where =
		query != null && query !== ""
			? inArray(
					schema.countryReports.countryDocumentId,
					db
						.select({ id: schema.entityVersions.entityId })
						.from(schema.organisationalUnits)
						.innerJoin(
							schema.entityVersions,
							eq(schema.entityVersions.id, schema.organisationalUnits.id),
						)
						.where(
							matchesAllTerms(
								query,
								schema.organisationalUnits.name,
								schema.organisationalUnits.acronym,
							),
						),
				)
			: undefined;
	const primaryOrderBy =
		sort === "country"
			? dir === "asc"
				? schema.organisationalUnits.name
				: desc(schema.organisationalUnits.name)
			: dir === "asc"
				? schema.reportingCampaigns.year
				: desc(schema.reportingCampaigns.year);
	const secondaryOrderBy =
		sort === "country"
			? desc(schema.reportingCampaigns.year)
			: asc(schema.organisationalUnits.name);

	const [data, aggregate] = await Promise.all([
		db
			.select({
				id: schema.countryReports.id,
				status: schema.countryReports.status,
				campaign: {
					id: schema.reportingCampaigns.id,
					year: schema.reportingCampaigns.year,
				},
				country: {
					id: schema.organisationalUnits.id,
					name: schema.organisationalUnits.name,
				},
			})
			.from(schema.countryReports)
			.innerJoin(
				schema.reportingCampaigns,
				eq(schema.countryReports.campaignId, schema.reportingCampaigns.id),
			)
			// resolve the country document → its latest editable org-unit version for the name.
			.innerJoin(schema.entities, eq(schema.entities.id, schema.countryReports.countryDocumentId))
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entities.id),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
			)
			.where(where)
			.orderBy(primaryOrderBy, secondaryOrderBy)
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.countryReports).where(where),
	]);

	return { data, total: aggregate[0]?.total ?? 0 };
}

export async function getCountryReportForAdmin(currentUser: Pick<User, "role">, id: string) {
	assertAdminUser(currentUser);

	const report = await db.query.countryReports.findFirst({
		where: { id },
		columns: { id: true, status: true },
		with: {
			campaign: { columns: { year: true } },
			// resolved through the published version; may be absent.
			country: { columns: { name: true } },
		},
	});

	if (report == null) {
		return null;
	}

	// A country report always references a published country.
	assert(report.country, "Country report is missing its published country.");
	return { ...report, country: report.country };
}

export async function getCountryReportCreateDataForAdmin(currentUser: Pick<User, "role">) {
	assertAdminUser(currentUser);

	const [campaigns, countries] = await Promise.all([
		db.query.reportingCampaigns.findMany({
			where: { status: "open" },
			orderBy: { year: "desc" },
			columns: { id: true, year: true },
		}),
		db
			// reports are keyed by document id; return the country's document id.
			.select({ id: schema.entityVersions.entityId, name: schema.organisationalUnits.name })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(and(publishedEntityVersionWhere(), eq(schema.organisationalUnitTypes.type, "country")))
			.orderBy(schema.organisationalUnits.name),
	]);

	return { campaigns, countries };
}

export async function getWorkingGroupReportsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetWorkingGroupReportsListParams>,
) {
	assertAdminUser(currentUser);

	const { dir = "desc", limit, offset, q, sort = "campaignYear" } = params;
	const query = q?.trim();
	// The report's working group is a document id; match it against the documents of name-matching units.
	const where =
		query != null && query !== ""
			? inArray(
					schema.workingGroupReports.workingGroupDocumentId,
					db
						.select({ id: schema.entityVersions.entityId })
						.from(schema.organisationalUnits)
						.innerJoin(
							schema.entityVersions,
							eq(schema.entityVersions.id, schema.organisationalUnits.id),
						)
						.where(
							matchesAllTerms(
								query,
								schema.organisationalUnits.name,
								schema.organisationalUnits.acronym,
							),
						),
				)
			: undefined;
	const primaryOrderBy =
		sort === "workingGroup"
			? dir === "asc"
				? schema.organisationalUnits.name
				: desc(schema.organisationalUnits.name)
			: dir === "asc"
				? schema.reportingCampaigns.year
				: desc(schema.reportingCampaigns.year);
	const secondaryOrderBy =
		sort === "workingGroup"
			? desc(schema.reportingCampaigns.year)
			: asc(schema.organisationalUnits.name);

	const [data, aggregate] = await Promise.all([
		db
			.select({
				id: schema.workingGroupReports.id,
				status: schema.workingGroupReports.status,
				campaign: {
					id: schema.reportingCampaigns.id,
					year: schema.reportingCampaigns.year,
				},
				workingGroup: {
					id: schema.organisationalUnits.id,
					name: schema.organisationalUnits.name,
				},
			})
			.from(schema.workingGroupReports)
			.innerJoin(
				schema.reportingCampaigns,
				eq(schema.workingGroupReports.campaignId, schema.reportingCampaigns.id),
			)
			// resolve the working group document → its latest editable org-unit version for the name.
			.innerJoin(
				schema.entities,
				eq(schema.entities.id, schema.workingGroupReports.workingGroupDocumentId),
			)
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entities.id),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
			)
			.where(where)
			.orderBy(primaryOrderBy, secondaryOrderBy)
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.workingGroupReports).where(where),
	]);

	return { data, total: aggregate[0]?.total ?? 0 };
}

export async function getWorkingGroupReportForAdmin(currentUser: Pick<User, "role">, id: string) {
	assertAdminUser(currentUser);

	const report = await db.query.workingGroupReports.findFirst({
		where: { id },
		columns: { id: true, status: true },
		with: {
			campaign: { columns: { year: true } },
			// resolved through the published version; may be absent.
			workingGroup: { columns: { name: true } },
		},
	});

	if (report == null) {
		return null;
	}

	// A working group report always references a published working group.
	assert(report.workingGroup, "Working group report is missing its published working group.");
	return { ...report, workingGroup: report.workingGroup };
}

export async function getWorkingGroupReportCreateDataForAdmin(currentUser: Pick<User, "role">) {
	assertAdminUser(currentUser);

	const [campaigns, workingGroups] = await Promise.all([
		db.query.reportingCampaigns.findMany({
			where: { status: "open" },
			orderBy: { year: "desc" },
			columns: { id: true, year: true },
		}),
		db
			// reports are keyed by document id; return the working group's document id.
			.select({ id: schema.entityVersions.entityId, name: schema.organisationalUnits.name })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(
				and(
					publishedEntityVersionWhere(),
					eq(schema.organisationalUnitTypes.type, "working_group"),
				),
			)
			.orderBy(schema.organisationalUnits.name),
	]);

	return { campaigns, workingGroups };
}

export async function getReportingCampaignsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetReportingCampaignsListParams>,
) {
	assertAdminUser(currentUser);

	const { dir = "desc", limit, offset, q } = params;
	const query = q?.trim();
	const where =
		query != null && query !== ""
			? sql<boolean>`${schema.reportingCampaigns.year}::text ilike ${`%${query}%`}`
			: undefined;
	const orderBy =
		dir === "asc" ? schema.reportingCampaigns.year : desc(schema.reportingCampaigns.year);

	const [campaigns, aggregate] = await Promise.all([
		db
			.select({
				id: schema.reportingCampaigns.id,
				year: schema.reportingCampaigns.year,
				status: schema.reportingCampaigns.status,
				countryReportCount: sql<number>`count(distinct ${schema.countryReports.id})::int`,
				workingGroupReportCount: sql<number>`count(distinct ${schema.workingGroupReports.id})::int`,
			})
			.from(schema.reportingCampaigns)
			.leftJoin(
				schema.countryReports,
				eq(schema.countryReports.campaignId, schema.reportingCampaigns.id),
			)
			.leftJoin(
				schema.workingGroupReports,
				eq(schema.workingGroupReports.campaignId, schema.reportingCampaigns.id),
			)
			.where(where)
			.groupBy(schema.reportingCampaigns.id)
			.orderBy(orderBy)
			.limit(limit)
			.offset(offset),
		db.select({ total: count() }).from(schema.reportingCampaigns).where(where),
	]);

	const data = campaigns.map((campaign) => {
		return {
			id: campaign.id,
			year: campaign.year,
			status: campaign.status,
			countryReportCount: campaign.countryReportCount,
			workingGroupReportCount: campaign.workingGroupReportCount,
			hasReports: campaign.countryReportCount + campaign.workingGroupReportCount > 0,
		};
	});

	return { data, total: aggregate[0]?.total ?? 0 };
}

export async function getReportingStatisticsForAdmin(
	currentUser: Pick<User, "role">,
	filters: ReportingStatisticsFilters = {},
): Promise<ReportingStatisticsData> {
	assertAdminUser(currentUser);

	const campaigns = await db.query.reportingCampaigns.findMany({
		orderBy: { year: "desc" },
		columns: { id: true, year: true, status: true },
		with: {
			countryReports: {
				columns: {
					id: true,
					status: true,
					countryDocumentId: true,
					totalContributors: true,
					smallEvents: true,
					mediumEvents: true,
					largeEvents: true,
					veryLargeEvents: true,
					dariahCommissionedEvent: true,
				},
				with: {
					country: { columns: { name: true } },
					// The document id, not the row id: an institution is captured once per representation
					// type, so the rows over-count it. See the `institutions` tally below.
					institutions: { columns: { organisationalUnitDocumentId: true } },
					serviceKpis: { columns: { serviceId: true } },
					// The project id too, so a contribution repeated across campaign years can be
					// recognised as the same one. See `latestContributionPerProject`.
					projectContributions: { columns: { amountEuros: true, projectDocumentId: true } },
				},
			},
			workingGroupReports: {
				columns: {
					id: true,
					status: true,
					numberOfMembers: true,
				},
				with: {
					events: { columns: { id: true, role: true } },
					socialMedia: { columns: { id: true } },
				},
			},
		},
	});

	const filteredCampaigns = campaigns
		.filter((campaign) => filters.campaignYear == null || campaign.year === filters.campaignYear)
		.map((campaign) => {
			const countryReports = campaign.countryReports.filter(
				(report) =>
					(filters.countryName == null || report.country?.name === filters.countryName) &&
					(filters.status == null || report.status === filters.status),
			);
			// A country filter excludes working-group reports entirely — they are not country-scoped.
			const workingGroupReports =
				filters.countryName != null
					? []
					: campaign.workingGroupReports.filter(
							(report) => filters.status == null || report.status === filters.status,
						);

			return {
				...campaign,
				countryReports,
				workingGroupReports,
			};
		})
		.filter(
			(campaign) => campaign.countryReports.length > 0 || campaign.workingGroupReports.length > 0,
		);

	const overview: ReportingStatisticsOverview = {
		campaignCount: filteredCampaigns.length,
		totalCountryReports: 0,
		totalContributors: 0,
		totalCountryEvents: 0,
		totalWorkingGroupEvents: 0,
		totalProjectContributions: 0,
		totalProjectContributionCount: 0,
		countryReportsWithProjectContributions: 0,
	};

	const campaignSummaries: Array<ReportingStatisticsCampaignSummary> = [];
	const countryTrendBaseRows: Array<
		Omit<
			ReportingStatisticsCountryTrend,
			"contributorsDelta" | "eventsDelta" | "projectContributionsDelta"
		>
	> = [];
	const workingGroupYearSummaries: Array<ReportingStatisticsWorkingGroupYearSummary> = [];

	/**
	 * The most recently reported contribution for each (country, project) pair.
	 *
	 * Under the current reporting forms a country re-reports a project in every campaign year it
	 * runs, and each time enters the contribution for the project's _whole duration_ — not the part
	 * falling in that year. Adding the rows up therefore multiplies the same money by however many
	 * years the project was active. Any total spanning more than one campaign year has to count each
	 * pair once.
	 *
	 * Where the reported amount changed between years the latest one wins: it is the country's most
	 * recent word on that project. Within a single campaign year there is nothing to collapse, since
	 * a country files one report per campaign and a report holds a project at most once.
	 */
	const latestContributionPerProject = new Map<string, { amountEuros: number; year: number }>();

	for (const campaign of filteredCampaigns) {
		let countryDraftCount = 0;
		let countrySubmittedCount = 0;
		let countryAcceptedCount = 0;
		let workingGroupDraftCount = 0;
		let workingGroupSubmittedCount = 0;
		let workingGroupAcceptedCount = 0;
		let totalContributors = 0;
		let totalCountryEvents = 0;
		let totalInstitutions = 0;
		let totalServices = 0;
		let totalProjectContributions = 0;
		let totalWorkingGroupMembers = 0;
		let totalWorkingGroupEvents = 0;
		let organiserEvents = 0;
		let presenterEvents = 0;
		let socialMediaAccounts = 0;

		for (const report of campaign.countryReports) {
			if (report.status === "draft") {
				countryDraftCount += 1;
			}
			if (report.status === "submitted") {
				countrySubmittedCount += 1;
			}
			if (report.status === "accepted") {
				countryAcceptedCount += 1;
			}

			const contributors = report.totalContributors ?? 0;
			// A DARIAH-commissioned event is captured by title rather than as a count, and counts as one
			// event — the same way the report's own operational-cost breakdown counts it. Leaving it out
			// made the dashboard disagree with every individual report it summarises.
			const events =
				(report.smallEvents ?? 0) +
				(report.mediumEvents ?? 0) +
				(report.largeEvents ?? 0) +
				(report.veryLargeEvents ?? 0) +
				(hasDariahCommissionedEvent(report.dariahCommissionedEvent) ? 1 : 0);
			// Distinct institutions, not rows: one institution can be captured once per representation
			// type, and the report summary groups them the same way before displaying them.
			const institutions = new Set(
				report.institutions.map((institution) => institution.organisationalUnitDocumentId),
			).size;
			const services = new Set(report.serviceKpis.map((serviceKpi) => serviceKpi.serviceId)).size;
			// Per campaign year this is a straight sum — a report holds each project at most once, so
			// there is nothing to collapse. It reads as "the whole-duration value of the projects this
			// country had running that year", not as money spent in that year.
			const projectContributions = report.projectContributions.reduce(
				(sum, contribution) => sum + contribution.amountEuros,
				0,
			);

			for (const contribution of report.projectContributions) {
				const key = `${report.countryDocumentId}:${contribution.projectDocumentId}`;
				const seen = latestContributionPerProject.get(key);

				if (seen == null || campaign.year > seen.year) {
					latestContributionPerProject.set(key, {
						amountEuros: contribution.amountEuros,
						year: campaign.year,
					});
				}
			}

			totalContributors += contributors;
			totalCountryEvents += events;
			totalInstitutions += institutions;
			totalServices += services;
			totalProjectContributions += projectContributions;

			if (report.projectContributions.length > 0) {
				overview.countryReportsWithProjectContributions += 1;
			}

			countryTrendBaseRows.push({
				campaignYear: campaign.year,
				countryName: report.country?.name ?? "",
				status: report.status,
				totalContributors: contributors,
				totalEvents: events,
				institutions,
				services,
				projectContributions,
			});
		}

		for (const report of campaign.workingGroupReports) {
			if (report.status === "draft") {
				workingGroupDraftCount += 1;
			}
			if (report.status === "submitted") {
				workingGroupSubmittedCount += 1;
			}
			if (report.status === "accepted") {
				workingGroupAcceptedCount += 1;
			}

			totalWorkingGroupMembers += report.numberOfMembers ?? 0;
			totalWorkingGroupEvents += report.events.length;
			socialMediaAccounts += report.socialMedia.length;

			for (const event of report.events) {
				if (event.role === "organiser") {
					organiserEvents += 1;
				}
				if (event.role === "presenter") {
					presenterEvents += 1;
				}
			}
		}

		overview.totalCountryReports += campaign.countryReports.length;
		overview.totalContributors += totalContributors;
		overview.totalCountryEvents += totalCountryEvents;
		overview.totalWorkingGroupEvents += totalWorkingGroupEvents;
		// `totalProjectContributions` is deliberately *not* accumulated per campaign here — summing the
		// yearly figures would re-add the same whole-duration amounts. It is set once, after the loop,
		// from the deduplicated pairs.

		campaignSummaries.push({
			id: campaign.id,
			year: campaign.year,
			status: campaign.status,
			countryDraftCount,
			countrySubmittedCount,
			countryAcceptedCount,
			workingGroupDraftCount,
			workingGroupSubmittedCount,
			workingGroupAcceptedCount,
			totalContributors,
			totalCountryEvents,
			totalInstitutions,
			totalServices,
			totalProjectContributions,
			totalWorkingGroupMembers,
			totalWorkingGroupEvents,
		});

		workingGroupYearSummaries.push({
			campaignYear: campaign.year,
			reportCount: campaign.workingGroupReports.length,
			draftCount: workingGroupDraftCount,
			submittedCount: workingGroupSubmittedCount,
			acceptedCount: workingGroupAcceptedCount,
			totalMembers: totalWorkingGroupMembers,
			totalEvents: totalWorkingGroupEvents,
			organiserEvents,
			presenterEvents,
			socialMediaAccounts,
		});
	}

	// Each (country, project) once, at its most recently reported amount — see
	// `latestContributionPerProject`. With a single campaign year in scope this is identical to the
	// per-year sum, because nothing repeats inside one year.
	for (const contribution of latestContributionPerProject.values()) {
		overview.totalProjectContributions += contribution.amountEuros;
	}
	overview.totalProjectContributionCount = latestContributionPerProject.size;

	const countryRowsByName = new Map<string, Array<(typeof countryTrendBaseRows)[number]>>();

	for (const row of countryTrendBaseRows) {
		const rows = countryRowsByName.get(row.countryName) ?? [];
		rows.push(row);
		countryRowsByName.set(row.countryName, rows);
	}

	const countryTrends = Array.from(countryRowsByName.entries())
		.toSorted(([left], [right]) => left.localeCompare(right))
		.flatMap(([, rows]) => {
			const sortedRows = rows
				.slice()
				.toSorted((left, right) => left.campaignYear - right.campaignYear);

			return sortedRows
				.map((row, index) => {
					const previousRow = sortedRows[index - 1];

					return {
						...row,
						contributorsDelta:
							previousRow != null ? row.totalContributors - previousRow.totalContributors : null,
						eventsDelta: previousRow != null ? row.totalEvents - previousRow.totalEvents : null,
						projectContributionsDelta:
							previousRow != null
								? row.projectContributions - previousRow.projectContributions
								: null,
					};
				})
				.toReversed();
		});

	return {
		overview,
		campaignSummaries,
		countryTrends,
		workingGroupYearSummaries,
	};
}

/**
 * Join predicate resolving a document to the version that carries its display name: the latest
 * editable one (published, else draft), so an entity whose publication was withdrawn still renders
 * with a name instead of dropping out of the statistics.
 *
 * Takes the lifecycle columns rather than the view itself so it accepts an `alias()`ed lifecycle —
 * the statistics queries join it more than once (country and project) in a single statement.
 */
function joinLatestEditableVersion(
	versionId: SQLWrapper,
	publishedId: SQLWrapper,
	draftId: SQLWrapper,
): SQL {
	return sql`${versionId} = COALESCE(${publishedId}, ${draftId})`;
}

export async function getReportingStatisticsFilterOptionsForAdmin(
	currentUser: Pick<User, "role">,
): Promise<ReportingStatisticsFilterOptions> {
	assertAdminUser(currentUser);

	const countryLifecycle = alias(schema.documentLifecycle, "country_document_lifecycle");

	const [campaigns, countries] = await Promise.all([
		db
			.select({ year: schema.reportingCampaigns.year })
			.from(schema.reportingCampaigns)
			.orderBy(desc(schema.reportingCampaigns.year)),
		// Only countries that actually have a report — an empty option would filter to nothing.
		db
			.selectDistinct({ name: schema.organisationalUnits.name })
			.from(schema.countryReports)
			.innerJoin(
				countryLifecycle,
				eq(countryLifecycle.documentId, schema.countryReports.countryDocumentId),
			)
			.innerJoin(
				schema.organisationalUnits,
				joinLatestEditableVersion(
					schema.organisationalUnits.id,
					countryLifecycle.publishedId,
					countryLifecycle.draftId,
				),
			)
			.orderBy(schema.organisationalUnits.name),
	]);

	return {
		campaignYears: campaigns.map((campaign) => campaign.year),
		countries: countries.map((country) => country.name),
	};
}

export type ReportingProjectContributionsSort = "amount" | "campaignYear" | "country" | "project";

interface GetReportingProjectContributionsParams
	extends GetReportingListParams, ReportingStatisticsFilters {
	dir?: ListSortDirection;
	sort?: ReportingProjectContributionsSort;
}

export interface ReportingProjectContributionRow {
	id: string;
	amountEuros: number;
	campaignYear: number;
	countryName: string;
	projectAcronym: string | null;
	projectName: string;
	projectSlug: string;
	status: string;
}

export interface ReportingProjectContributionsData {
	data: Array<ReportingProjectContributionRow>;
	/** Reported entries in the filtered set — the rows the table lists, one per campaign year. */
	total: number;
	/** Distinct country–project pairs behind those entries. */
	totalPairs: number;
	/**
	 * Sum over the whole filtered set, counting each country–project pair once at its most recently
	 * reported amount. Adding the listed rows up instead would multiply a project's contribution by
	 * the number of campaign years it was reported in.
	 */
	totalAmountEuros: number;
}

/**
 * The project contributions reported by each country, one row per (report, project) pair — which
 * country reported which project, in which campaign year, for how much. Aggregate country/campaign
 * totals live in {@link getReportingStatisticsForAdmin}; this is the line-item view behind them.
 */
export async function getReportingProjectContributionsForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetReportingProjectContributionsParams>,
): Promise<ReportingProjectContributionsData> {
	assertAdminUser(currentUser);

	const {
		campaignYear,
		countryName,
		dir = "desc",
		limit,
		offset,
		q,
		sort = "campaignYear",
		status,
	} = params;

	const countryLifecycle = alias(schema.documentLifecycle, "country_document_lifecycle");
	const projectLifecycle = alias(schema.documentLifecycle, "project_document_lifecycle");
	const projectEntities = alias(schema.entities, "project_entities");

	/**
	 * The filters below reach into the joined campaign, country, and project tables, so the aggregate
	 * query needs exactly the same `FROM` as the paged one. Applied to both via `$dynamic()` rather
	 * than written out twice, where the two copies could drift apart.
	 */
	function withContributionJoins<TQuery extends PgSelect>(query: TQuery) {
		return query
			.innerJoin(
				schema.countryReports,
				eq(schema.countryReports.id, schema.countryReportProjectContributions.countryReportId),
			)
			.innerJoin(
				schema.reportingCampaigns,
				eq(schema.reportingCampaigns.id, schema.countryReports.campaignId),
			)
			.innerJoin(
				countryLifecycle,
				eq(countryLifecycle.documentId, schema.countryReports.countryDocumentId),
			)
			.innerJoin(
				schema.organisationalUnits,
				joinLatestEditableVersion(
					schema.organisationalUnits.id,
					countryLifecycle.publishedId,
					countryLifecycle.draftId,
				),
			)
			.innerJoin(
				projectEntities,
				eq(projectEntities.id, schema.countryReportProjectContributions.projectDocumentId),
			)
			.innerJoin(projectLifecycle, eq(projectLifecycle.documentId, projectEntities.id))
			.innerJoin(
				schema.projects,
				joinLatestEditableVersion(
					schema.projects.id,
					projectLifecycle.publishedId,
					projectLifecycle.draftId,
				),
			);
	}

	const where = and(
		campaignYear != null ? eq(schema.reportingCampaigns.year, campaignYear) : undefined,
		countryName != null && countryName !== ""
			? eq(schema.organisationalUnits.name, countryName)
			: undefined,
		status != null ? eq(schema.countryReports.status, status) : undefined,
		matchesAllTerms(q, schema.projects.name, schema.projects.acronym),
	);

	const direction = dir === "asc" ? asc : desc;
	const primaryOrderBy = {
		amount: direction(schema.countryReportProjectContributions.amountEuros),
		campaignYear: direction(schema.reportingCampaigns.year),
		country: direction(schema.organisationalUnits.name),
		project: direction(schema.projects.name),
	}[sort];

	/**
	 * The filtered rows, each ranked within its (country, project) pair with the newest campaign year
	 * first. A window function cannot sit inside an aggregate, so the ranking has to happen one level
	 * down and the totals are then taken over this.
	 */
	const rankedContributions = withContributionJoins(
		db
			.select({
				amountEuros: schema.countryReportProjectContributions.amountEuros,
				pairRank:
					sql<number>`ROW_NUMBER() OVER (PARTITION BY ${schema.countryReports.countryDocumentId}, ${schema.countryReportProjectContributions.projectDocumentId} ORDER BY ${schema.reportingCampaigns.year} DESC)`.as(
						"pair_rank",
					),
			})
			.from(schema.countryReportProjectContributions)
			.$dynamic(),
	)
		.where(where)
		.as("ranked_contributions");

	const [data, aggregate] = await Promise.all([
		withContributionJoins(
			db
				.select({
					id: schema.countryReportProjectContributions.id,
					amountEuros: schema.countryReportProjectContributions.amountEuros,
					campaignYear: schema.reportingCampaigns.year,
					countryName: schema.organisationalUnits.name,
					projectAcronym: schema.projects.acronym,
					projectName: schema.projects.name,
					projectSlug: schema.slugs.value,
					status: schema.countryReports.status,
				})
				.from(schema.countryReportProjectContributions)
				.$dynamic(),
		)
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.projects.id))
			.where(where)
			// Tie-breakers keep paging stable when the primary column has duplicates.
			.orderBy(
				primaryOrderBy,
				asc(schema.organisationalUnits.name),
				asc(schema.projects.name),
				asc(schema.countryReportProjectContributions.id),
			)
			.limit(limit)
			.offset(offset),
		db
			.select({
				total: count(),
				// A pair's newest row carries its current amount; the rest are the same money re-reported.
				// `SUM` over `numeric` comes back as a string, hence the cast.
				totalAmountEuros: sql<number>`COALESCE(SUM(${rankedContributions.amountEuros}) FILTER (WHERE ${rankedContributions.pairRank} = 1), 0)::float8`,
				totalPairs: sql<number>`COUNT(*) FILTER (WHERE ${rankedContributions.pairRank} = 1)`,
			})
			.from(rankedContributions),
	]);

	return {
		data,
		total: aggregate[0]?.total ?? 0,
		totalPairs: aggregate[0]?.totalPairs ?? 0,
		totalAmountEuros: aggregate[0]?.totalAmountEuros ?? 0,
	};
}

export type ReportingKpiSort = "campaignYear" | "country" | "entity" | "kpi" | "value";

interface GetReportingKpisParams extends GetReportingListParams, ReportingStatisticsFilters {
	dir?: ListSortDirection;
	/** One of the entity's KPI categories; absent means every category. */
	kpi?: string;
	sort?: ReportingKpiSort;
}

/**
 * One reported KPI value. `entityName`/`entityType` are the service or social-media account the
 * value belongs to — the two KPI tabs render the same shape.
 */
export interface ReportingKpiRow {
	id: string;
	campaignYear: number;
	countryName: string;
	entityName: string;
	entityType: string;
	kpi: string;
	status: string;
	value: number;
}

export interface ReportingKpisData {
	data: Array<ReportingKpiRow>;
	total: number;
	/**
	 * Sum over the whole filtered set, but only when a single KPI category is selected. Adding
	 * followers to page views produces a number that means nothing, so mixed categories return null
	 * and the caller shows no total.
	 */
	totalValue: number | null;
}

/**
 * The parts of a KPI query that differ between services and social media: which column holds the
 * entity's name and type, and which column holds the KPI category.
 *
 * Only the filter and sort expressions are shared this way. The join chains stay written out in
 * each function, where Drizzle can infer the row types — threading a join helper through a common
 * signature erases them and buys a cast for every column.
 */
interface ReportingKpiColumns {
	entityName: PgColumn;
	entityType: PgColumn;
	kpi: PgColumn;
	value: PgColumn;
}

function reportingKpiWhere(
	params: Readonly<GetReportingKpisParams>,
	columns: Readonly<Pick<ReportingKpiColumns, "entityName" | "kpi">>,
): SQL | undefined {
	const { campaignYear, countryName, kpi, q, status } = params;

	return and(
		campaignYear != null ? eq(schema.reportingCampaigns.year, campaignYear) : undefined,
		countryName != null && countryName !== ""
			? eq(schema.organisationalUnits.name, countryName)
			: undefined,
		status != null ? eq(schema.countryReports.status, status) : undefined,
		kpi != null && kpi !== "" ? eq(columns.kpi, kpi) : undefined,
		matchesAllTerms(q, columns.entityName),
	);
}

function reportingKpiOrderBy(
	params: Readonly<GetReportingKpisParams>,
	columns: Readonly<ReportingKpiColumns>,
): SQL {
	const { dir = "desc", sort = "campaignYear" } = params;
	const direction = dir === "asc" ? asc : desc;

	return {
		campaignYear: direction(schema.reportingCampaigns.year),
		country: direction(schema.organisationalUnits.name),
		entity: direction(columns.entityName),
		kpi: direction(columns.kpi),
		value: direction(columns.value),
	}[sort];
}

/** Sum over the filtered set — meaningful only within one category, so it is gated on that. */
function reportingKpiTotalValue(
	kpi: string | undefined,
	totalValue: number | undefined,
): number | null {
	return kpi != null && kpi !== "" ? (totalValue ?? 0) : null;
}

/**
 * Reported service KPIs, one row per (report, service, KPI). Country reports carry a set of
 * services and a value per KPI category for each; this is the flattened line-item view of those.
 */
export async function getReportingServiceKpisForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetReportingKpisParams>,
): Promise<ReportingKpisData> {
	assertAdminUser(currentUser);

	const { limit, offset } = params;
	const countryLifecycle = alias(schema.documentLifecycle, "country_document_lifecycle");
	const columns: ReportingKpiColumns = {
		entityName: schema.services.name,
		entityType: schema.serviceTypes.type,
		kpi: schema.countryReportServiceKpis.kpi,
		value: schema.countryReportServiceKpis.value,
	};

	function withJoins<TQuery extends PgSelect>(query: TQuery) {
		return (
			query
				.innerJoin(
					schema.countryReports,
					eq(schema.countryReports.id, schema.countryReportServiceKpis.countryReportId),
				)
				.innerJoin(
					schema.reportingCampaigns,
					eq(schema.reportingCampaigns.id, schema.countryReports.campaignId),
				)
				.innerJoin(
					countryLifecycle,
					eq(countryLifecycle.documentId, schema.countryReports.countryDocumentId),
				)
				.innerJoin(
					schema.organisationalUnits,
					joinLatestEditableVersion(
						schema.organisationalUnits.id,
						countryLifecycle.publishedId,
						countryLifecycle.draftId,
					),
				)
				// Services are plain records rather than versioned documents, so they join directly.
				.innerJoin(
					schema.services,
					eq(schema.services.id, schema.countryReportServiceKpis.serviceId),
				)
				.innerJoin(schema.serviceTypes, eq(schema.serviceTypes.id, schema.services.typeId))
		);
	}

	const where = reportingKpiWhere(params, columns);

	const [data, aggregate] = await Promise.all([
		withJoins(
			db
				.select({
					id: schema.countryReportServiceKpis.id,
					campaignYear: schema.reportingCampaigns.year,
					countryName: schema.organisationalUnits.name,
					entityName: schema.services.name,
					entityType: schema.serviceTypes.type,
					kpi: schema.countryReportServiceKpis.kpi,
					status: schema.countryReports.status,
					value: schema.countryReportServiceKpis.value,
				})
				.from(schema.countryReportServiceKpis)
				.$dynamic(),
		)
			.where(where)
			.orderBy(
				reportingKpiOrderBy(params, columns),
				asc(schema.organisationalUnits.name),
				asc(schema.services.name),
				asc(schema.countryReportServiceKpis.id),
			)
			.limit(limit)
			.offset(offset),
		withJoins(
			db
				.select({
					total: count(),
					totalValue: sql<number>`COALESCE(SUM(${schema.countryReportServiceKpis.value}), 0)::float8`,
				})
				.from(schema.countryReportServiceKpis)
				.$dynamic(),
		).where(where),
	]);

	return {
		data,
		total: aggregate[0]?.total ?? 0,
		totalValue: reportingKpiTotalValue(params.kpi, aggregate[0]?.totalValue),
	};
}

/** Reported social-media KPIs, one row per (report, account, KPI). Mirrors the service KPIs. */
export async function getReportingSocialMediaKpisForAdmin(
	currentUser: Pick<User, "role">,
	params: Readonly<GetReportingKpisParams>,
): Promise<ReportingKpisData> {
	assertAdminUser(currentUser);

	const { limit, offset } = params;
	const countryLifecycle = alias(schema.documentLifecycle, "country_document_lifecycle");
	const columns: ReportingKpiColumns = {
		entityName: schema.socialMedia.name,
		entityType: schema.socialMediaTypes.type,
		kpi: schema.countryReportSocialMediaKpis.kpi,
		value: schema.countryReportSocialMediaKpis.value,
	};

	function withJoins<TQuery extends PgSelect>(query: TQuery) {
		return query
			.innerJoin(
				schema.countryReports,
				eq(schema.countryReports.id, schema.countryReportSocialMediaKpis.countryReportId),
			)
			.innerJoin(
				schema.reportingCampaigns,
				eq(schema.reportingCampaigns.id, schema.countryReports.campaignId),
			)
			.innerJoin(
				countryLifecycle,
				eq(countryLifecycle.documentId, schema.countryReports.countryDocumentId),
			)
			.innerJoin(
				schema.organisationalUnits,
				joinLatestEditableVersion(
					schema.organisationalUnits.id,
					countryLifecycle.publishedId,
					countryLifecycle.draftId,
				),
			)
			.innerJoin(
				schema.socialMedia,
				eq(schema.socialMedia.id, schema.countryReportSocialMediaKpis.socialMediaId),
			)
			.innerJoin(
				schema.socialMediaTypes,
				eq(schema.socialMediaTypes.id, schema.socialMedia.typeId),
			);
	}

	const where = reportingKpiWhere(params, columns);

	const [data, aggregate] = await Promise.all([
		withJoins(
			db
				.select({
					id: schema.countryReportSocialMediaKpis.id,
					campaignYear: schema.reportingCampaigns.year,
					countryName: schema.organisationalUnits.name,
					entityName: schema.socialMedia.name,
					entityType: schema.socialMediaTypes.type,
					kpi: schema.countryReportSocialMediaKpis.kpi,
					status: schema.countryReports.status,
					value: schema.countryReportSocialMediaKpis.value,
				})
				.from(schema.countryReportSocialMediaKpis)
				.$dynamic(),
		)
			.where(where)
			.orderBy(
				reportingKpiOrderBy(params, columns),
				asc(schema.organisationalUnits.name),
				asc(schema.socialMedia.name),
				asc(schema.countryReportSocialMediaKpis.id),
			)
			.limit(limit)
			.offset(offset),
		withJoins(
			db
				.select({
					total: count(),
					totalValue: sql<number>`COALESCE(SUM(${schema.countryReportSocialMediaKpis.value}), 0)::float8`,
				})
				.from(schema.countryReportSocialMediaKpis)
				.$dynamic(),
		).where(where),
	]);

	return {
		data,
		total: aggregate[0]?.total ?? 0,
		totalValue: reportingKpiTotalValue(params.kpi, aggregate[0]?.totalValue),
	};
}

export async function getReportingCampaignHeaderForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
) {
	assertAdminUser(currentUser);

	return db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { id: true, year: true },
	});
}

export async function getReportingCampaignSettingsForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
) {
	assertAdminUser(currentUser);

	return db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { id: true, year: true, status: true },
	});
}

export async function getReportingCampaignEventAmountsForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
) {
	assertAdminUser(currentUser);

	return db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { id: true },
		with: {
			eventAmounts: {
				columns: { eventType: true, amount: true },
			},
		},
	});
}

export async function getReportingCampaignCountryThresholdsForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
) {
	assertAdminUser(currentUser);

	const [campaign, countries] = await Promise.all([
		db.query.reportingCampaigns.findFirst({
			where: { id },
			columns: { id: true },
			with: {
				countryThresholds: {
					columns: { countryDocumentId: true, amount: true },
				},
			},
		}),
		db
			// thresholds are keyed by country document id; return the document id.
			.select({ id: schema.entityVersions.entityId, name: schema.organisationalUnits.name })
			.from(schema.organisationalUnits)
			.innerJoin(schema.entityVersions, eq(schema.organisationalUnits.id, schema.entityVersions.id))
			.innerJoin(schema.entityStatus, eq(schema.entityVersions.statusId, schema.entityStatus.id))
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.where(and(publishedEntityVersionWhere(), eq(schema.organisationalUnitTypes.type, "country")))
			.orderBy(schema.organisationalUnits.name),
	]);

	return { campaign, countries };
}

export async function getReportingCampaignContributionAmountsForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
) {
	assertAdminUser(currentUser);

	return db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { id: true },
		with: {
			contributionAmounts: {
				columns: { roleType: true, amount: true },
			},
		},
	});
}

export async function getReportingCampaignQuestionsForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
) {
	assertAdminUser(currentUser);

	return db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { id: true },
		with: {
			workingGroupReportQuestions: {
				columns: { id: true, question: true, position: true },
				orderBy: { position: "asc" },
			},
		},
	});
}

export async function getReportingCampaignServiceSizesForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
) {
	assertAdminUser(currentUser);

	return db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { id: true },
		with: {
			serviceSizes: {
				columns: { serviceSize: true, visitsThreshold: true, amount: true },
			},
		},
	});
}

export async function getReportingCampaignSocialMediaAmountsForAdmin(
	currentUser: Pick<User, "role">,
	id: string,
) {
	assertAdminUser(currentUser);

	return db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { id: true },
		with: {
			socialMediaAmounts: {
				columns: { category: true, amount: true },
			},
		},
	});
}
