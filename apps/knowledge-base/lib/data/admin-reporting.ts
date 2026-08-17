/* eslint-disable @typescript-eslint/explicit-module-boundary-types */

import { assert } from "@acdh-oeaw/lib";
import type { User } from "@dariah-eric/auth";
import * as schema from "@dariah-eric/database/schema";
import { forbidden } from "next/navigation";

import { publishedEntityVersionWhere } from "@/lib/data/current-entity-version";
import { db } from "@/lib/db";
import { unaccentIlike } from "@/lib/db/search";
import { and, asc, count, desc, eq, inArray, sql } from "@/lib/db/sql";
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
	totalWorkingGroupReports: number;
	totalContributors: number;
	totalCountryEvents: number;
	totalWorkingGroupEvents: number;
	totalProjectContributions: number;
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
	filterOptions: {
		campaignYears: Array<number>;
		countries: Array<string>;
	};
}

export interface ReportingStatisticsFilters {
	campaignYear?: number;
	countryName?: string;
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
						.where(unaccentIlike(schema.organisationalUnits.name, `%${query}%`)),
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
						.where(unaccentIlike(schema.organisationalUnits.name, `%${query}%`)),
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
					totalContributors: true,
					smallEvents: true,
					mediumEvents: true,
					largeEvents: true,
					veryLargeEvents: true,
				},
				with: {
					country: { columns: { name: true } },
					institutions: { columns: { id: true } },
					serviceKpis: { columns: { serviceId: true } },
					projectContributions: { columns: { amountEuros: true } },
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

	const filterOptions = {
		campaignYears: campaigns.map((campaign) => campaign.year),
		countries: Array.from(
			new Set(
				campaigns.flatMap((campaign) =>
					campaign.countryReports.map((report) => report.country?.name ?? ""),
				),
			),
		).toSorted((left, right) => left.localeCompare(right)),
	};

	const filteredCampaigns = campaigns
		.filter((campaign) => filters.campaignYear == null || campaign.year === filters.campaignYear)
		.map((campaign) => {
			const countryReports = campaign.countryReports.filter(
				(report) => filters.countryName == null || report.country?.name === filters.countryName,
			);
			const workingGroupReports = filters.countryName == null ? campaign.workingGroupReports : [];

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
		totalWorkingGroupReports: 0,
		totalContributors: 0,
		totalCountryEvents: 0,
		totalWorkingGroupEvents: 0,
		totalProjectContributions: 0,
	};

	const campaignSummaries: Array<ReportingStatisticsCampaignSummary> = [];
	const countryTrendBaseRows: Array<
		Omit<
			ReportingStatisticsCountryTrend,
			"contributorsDelta" | "eventsDelta" | "projectContributionsDelta"
		>
	> = [];
	const workingGroupYearSummaries: Array<ReportingStatisticsWorkingGroupYearSummary> = [];

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
			const events =
				(report.smallEvents ?? 0) +
				(report.mediumEvents ?? 0) +
				(report.largeEvents ?? 0) +
				(report.veryLargeEvents ?? 0);
			const institutions = report.institutions.length;
			const services = new Set(report.serviceKpis.map((serviceKpi) => serviceKpi.serviceId)).size;
			const projectContributions = report.projectContributions.reduce(
				(sum, contribution) => sum + contribution.amountEuros,
				0,
			);

			totalContributors += contributors;
			totalCountryEvents += events;
			totalInstitutions += institutions;
			totalServices += services;
			totalProjectContributions += projectContributions;

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
		overview.totalWorkingGroupReports += campaign.workingGroupReports.length;
		overview.totalContributors += totalContributors;
		overview.totalCountryEvents += totalCountryEvents;
		overview.totalWorkingGroupEvents += totalWorkingGroupEvents;
		overview.totalProjectContributions += totalProjectContributions;

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
		filterOptions,
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
