import type { User } from "@acdh-knowledge-base/auth";
import * as schema from "@acdh-knowledge-base/database/schema";

import { db } from "@/lib/db";
import { and, desc, eq, inArray, sql } from "@/lib/db/sql";

const chairRoles = ["is_chair_of", "is_vice_chair_of"] as const;
const coordinatorRoles = ["national_coordinator", "national_coordinator_deputy"] as const;

const relevantRoles = [
	"is_chair_of",
	"is_vice_chair_of",
	"national_coordinator",
	"national_coordinator_deputy",
	"national_coordination_staff",
	"national_representative",
	"national_representative_deputy",
] as const;

export interface WorkingGroupReportScope {
	reportId: string;
	reportHref: string;
	workingGroupName: string;
	status: string;
	canConfirm: boolean;
}

export interface CountryReportScope {
	reportId: string;
	reportHref: string;
	countryName: string;
	status: string;
	canConfirm: boolean;
}

export async function getUserReportingScope(user: User): Promise<{
	campaignYear: number | null;
	workingGroupReports: Array<WorkingGroupReportScope>;
	countryReports: Array<CountryReportScope>;
}> {
	const empty = { campaignYear: null, workingGroupReports: [], countryReports: [] };

	const openCampaign = await db.query.reportingCampaigns.findFirst({
		where: { status: "open" },
		columns: { id: true, year: true },
	});

	if (openCampaign == null) {
		return empty;
	}

	const wgReportItems: Array<WorkingGroupReportScope> = [];
	const countryReportItems: Array<CountryReportScope> = [];

	if (user.personDocumentId != null) {
		const { personDocumentId } = user;

		// `user.personDocumentId` is a person document id, matching the relation table directly. Orgs are
		// identified by their document id (matched against the reports' resolved document ids below).
		const relations = await db
			.select({
				orgUnitId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				orgUnitName: schema.organisationalUnits.name,
				orgUnitType: schema.organisationalUnitTypes.type,
				orgUnitSlug: schema.entities.slug,
				roleType: schema.personRoleTypes.type,
			})
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				schema.entities,
				eq(schema.entities.id, schema.personsToOrganisationalUnits.organisationalUnitDocumentId),
			)
			.innerJoin(
				schema.documentLifecycle,
				eq(schema.documentLifecycle.documentId, schema.entities.id),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.where(
				and(
					eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId),
					sql`${schema.personsToOrganisationalUnits.duration} @> NOW()::TIMESTAMPTZ`,
					inArray(schema.organisationalUnitTypes.type, ["working_group", "country"]),
					inArray(schema.personRoleTypes.type, [...relevantRoles]),
				),
			);

		const wgOrgUnitIds = [
			...new Set(
				relations.filter((r) => r.orgUnitType === "working_group").map((r) => r.orgUnitId),
			),
		];

		if (wgOrgUnitIds.length > 0) {
			// reports identify their org by document id, matching `wgOrgUnitIds` directly.
			const wgReports = await db
				.select({
					id: schema.workingGroupReports.id,
					status: schema.workingGroupReports.status,
					workingGroupId: schema.workingGroupReports.workingGroupDocumentId,
				})
				.from(schema.workingGroupReports)
				.where(
					and(
						eq(schema.workingGroupReports.campaignId, openCampaign.id),
						inArray(schema.workingGroupReports.workingGroupDocumentId, wgOrgUnitIds),
					),
				);

			for (const report of wgReports) {
				const relationsForWg = relations.filter(
					(r) => r.orgUnitId === report.workingGroupId && r.orgUnitType === "working_group",
				);
				const canConfirm = relationsForWg.some((r) =>
					(chairRoles as ReadonlyArray<string>).includes(r.roleType),
				);
				wgReportItems.push({
					reportId: report.id,
					reportHref: `/dashboard/reporting/working-group-reports/${openCampaign.year}/${relationsForWg[0]?.orgUnitSlug ?? ""}`,
					workingGroupName: relationsForWg[0]?.orgUnitName ?? "",
					status: report.status,
					canConfirm,
				});
			}
		}

		const countryOrgUnitIds = [
			...new Set(relations.filter((r) => r.orgUnitType === "country").map((r) => r.orgUnitId)),
		];

		if (countryOrgUnitIds.length > 0) {
			// reports identify their org by document id, matching `countryOrgUnitIds` directly.
			const personCountryReports = await db
				.select({
					id: schema.countryReports.id,
					status: schema.countryReports.status,
					countryId: schema.countryReports.countryDocumentId,
				})
				.from(schema.countryReports)
				.where(
					and(
						eq(schema.countryReports.campaignId, openCampaign.id),
						inArray(schema.countryReports.countryDocumentId, countryOrgUnitIds),
					),
				);

			for (const report of personCountryReports) {
				const relationsForCountry = relations.filter(
					(r) => r.orgUnitId === report.countryId && r.orgUnitType === "country",
				);
				const canConfirm = relationsForCountry.some((r) =>
					(coordinatorRoles as ReadonlyArray<string>).includes(r.roleType),
				);
				countryReportItems.push({
					reportId: report.id,
					reportHref: `/dashboard/reporting/country-reports/${openCampaign.year}/${relationsForCountry[0]?.orgUnitSlug ?? ""}`,
					countryName: relationsForCountry[0]?.orgUnitName ?? "",
					status: report.status,
					canConfirm,
				});
			}
		}
	}

	if (user.organisationalUnitDocumentId != null) {
		// The country actor and the report's country are both document ids, matching directly.
		const report = await db.query.countryReports.findFirst({
			where: {
				campaignId: openCampaign.id,
				countryDocumentId: user.organisationalUnitDocumentId,
			},
			columns: { id: true, status: true },
		});

		if (report != null) {
			const alreadyIncluded = countryReportItems.some((r) => r.reportId === report.id);
			if (!alreadyIncluded) {
				// resolve the country document → published version for its name/slug.
				const country = await db
					.select({ name: schema.organisationalUnits.name, slug: schema.entities.slug })
					.from(schema.documentLifecycle)
					.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
					.innerJoin(
						schema.organisationalUnits,
						eq(schema.organisationalUnits.id, schema.documentLifecycle.publishedId),
					)
					.where(eq(schema.documentLifecycle.documentId, user.organisationalUnitDocumentId))
					.then((rows) => rows[0] ?? null);
				countryReportItems.push({
					reportId: report.id,
					reportHref: `/dashboard/reporting/country-reports/${openCampaign.year}/${country?.slug ?? ""}`,
					countryName: country?.name ?? "",
					status: report.status,
					canConfirm: false,
				});
			}
		}
	}

	return {
		campaignYear: openCampaign.year,
		workingGroupReports: wgReportItems,
		countryReports: countryReportItems,
	};
}

export interface CountryReportHistoryItem {
	reportId: string;
	reportHref: string;
	countryName: string;
	reportStatus: string;
	campaignYear: number;
	campaignStatus: string;
}

export async function getUserAllCountryReports(
	user: User,
): Promise<Array<CountryReportHistoryItem>> {
	const countryOrgUnitIds: Array<string> = [];

	if (user.personDocumentId != null) {
		const { personDocumentId } = user;
		const relations = await db
			.select({ orgUnitId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId })
			.from(schema.personsToOrganisationalUnits)
			.innerJoin(
				schema.documentLifecycle,
				eq(
					schema.documentLifecycle.documentId,
					schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
				),
			)
			.innerJoin(
				schema.organisationalUnits,
				sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
			)
			.innerJoin(
				schema.organisationalUnitTypes,
				eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
			)
			.innerJoin(
				schema.personRoleTypes,
				eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
			)
			.where(
				and(
					eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId),
					eq(schema.organisationalUnitTypes.type, "country"),
					inArray(schema.personRoleTypes.type, [...relevantRoles]),
				),
			);

		countryOrgUnitIds.push(...relations.map((r) => r.orgUnitId));
	}

	if (user.organisationalUnitDocumentId != null) {
		// The country actor is already a document id, matching `countryOrgUnitIds`.
		countryOrgUnitIds.push(user.organisationalUnitDocumentId);
	}

	if (countryOrgUnitIds.length === 0) {
		return [];
	}

	const uniqueIds = [...new Set(countryOrgUnitIds)];

	const rows = await db
		.select({
			id: schema.countryReports.id,
			slug: schema.entities.slug,
			reportStatus: schema.countryReports.status,
			countryName: schema.organisationalUnits.name,
			campaignYear: schema.reportingCampaigns.year,
			campaignStatus: schema.reportingCampaigns.status,
		})
		.from(schema.countryReports)
		.innerJoin(
			schema.reportingCampaigns,
			eq(schema.reportingCampaigns.id, schema.countryReports.campaignId),
		)
		// the report's country is a document; resolve it to its latest editable version for the name.
		.innerJoin(schema.entities, eq(schema.entities.id, schema.countryReports.countryDocumentId))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(inArray(schema.countryReports.countryDocumentId, uniqueIds))
		.orderBy(desc(schema.reportingCampaigns.year));

	return rows.map((r) => {
		return {
			reportId: r.id,
			reportHref: `/dashboard/reporting/country-reports/${r.campaignYear}/${r.slug}`,
			countryName: r.countryName,
			reportStatus: r.reportStatus,
			campaignYear: r.campaignYear,
			campaignStatus: r.campaignStatus,
		};
	});
}

export interface WorkingGroupReportHistoryItem {
	reportId: string;
	reportHref: string;
	workingGroupName: string;
	reportStatus: string;
	campaignYear: number;
	campaignStatus: string;
}

export async function getUserAllWorkingGroupReports(
	user: User,
): Promise<Array<WorkingGroupReportHistoryItem>> {
	if (user.personDocumentId == null) {
		return [];
	}

	const { personDocumentId } = user;
	const relations = await db
		.select({ orgUnitId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId })
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.documentLifecycle,
			eq(
				schema.documentLifecycle.documentId,
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.where(
			and(
				eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId),
				eq(schema.organisationalUnitTypes.type, "working_group"),
				inArray(schema.personRoleTypes.type, [...relevantRoles]),
			),
		);

	const wgOrgUnitIds = [...new Set(relations.map((r) => r.orgUnitId))];

	if (wgOrgUnitIds.length === 0) {
		return [];
	}

	const rows = await db
		.select({
			id: schema.workingGroupReports.id,
			slug: schema.entities.slug,
			reportStatus: schema.workingGroupReports.status,
			workingGroupName: schema.organisationalUnits.name,
			campaignYear: schema.reportingCampaigns.year,
			campaignStatus: schema.reportingCampaigns.status,
		})
		.from(schema.workingGroupReports)
		.innerJoin(
			schema.reportingCampaigns,
			eq(schema.reportingCampaigns.id, schema.workingGroupReports.campaignId),
		)
		// the report's working group is a document; resolve to its latest editable version for the name.
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
		.where(inArray(schema.workingGroupReports.workingGroupDocumentId, wgOrgUnitIds))
		.orderBy(desc(schema.reportingCampaigns.year));

	return rows.map((r) => {
		return {
			reportId: r.id,
			reportHref: `/dashboard/reporting/working-group-reports/${r.campaignYear}/${r.slug}`,
			workingGroupName: r.workingGroupName,
			reportStatus: r.reportStatus,
			campaignYear: r.campaignYear,
			campaignStatus: r.campaignStatus,
		};
	});
}
