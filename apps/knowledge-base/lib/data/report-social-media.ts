import * as schema from "@dariah-eric/database/schema";

import { type Database, type Transaction, db } from "@/lib/db";
import { and, eq, notInArray, sql } from "@/lib/db/sql";

export type SocialMediaKpiCategory = (typeof schema.socialMediaKpiCategoryEnum)[number];

export interface ReportSocialMediaAccount {
	/** The membership row id (`country_report_social_media.id`), used to remove the account. */
	id: string;
	socialMediaId: string;
	name: string;
	url: string;
	kpis: Array<{ kpi: SocialMediaKpiCategory; value: number }>;
}

/**
 * The social media accounts a country report covers (its membership rows), each with the KPI values
 * recorded for it. Sorted by account name.
 */
export async function getCountryReportSocialMedia(
	countryReportId: string,
): Promise<Array<ReportSocialMediaAccount>> {
	const memberships = await db.query.countryReportSocialMedia.findMany({
		where: { countryReportId },
		columns: { id: true, socialMediaId: true },
		with: { socialMedia: { columns: { name: true, url: true } } },
	});

	const kpiRows = await db.query.countryReportSocialMediaKpis.findMany({
		where: { countryReportId },
		columns: { socialMediaId: true, kpi: true, value: true },
	});
	const kpisByAccount = new Map<string, Array<{ kpi: SocialMediaKpiCategory; value: number }>>();
	for (const row of kpiRows) {
		const list = kpisByAccount.get(row.socialMediaId) ?? [];
		list.push({ kpi: row.kpi, value: row.value });
		kpisByAccount.set(row.socialMediaId, list);
	}

	return memberships
		.map((membership) => {
			return {
				id: membership.id,
				socialMediaId: membership.socialMediaId,
				name: membership.socialMedia.name,
				url: membership.socialMedia.url,
				kpis: kpisByAccount.get(membership.socialMediaId) ?? [],
			};
		})
		.toSorted((a, b) => a.name.localeCompare(b.name));
}

export interface AvailableSocialMediaAccount {
	id: string;
	name: string;
	url: string;
}

/** All social media accounts not already covered by the report — the "add existing" picker source. */
export async function getAvailableSocialMediaForReport(
	countryReportId: string,
): Promise<Array<AvailableSocialMediaAccount>> {
	const claimed = await db.query.countryReportSocialMedia.findMany({
		where: { countryReportId },
		columns: { socialMediaId: true },
	});
	const claimedIds = claimed.map((row) => row.socialMediaId);

	const base = db
		.select({
			id: schema.socialMedia.id,
			name: schema.socialMedia.name,
			url: schema.socialMedia.url,
		})
		.from(schema.socialMedia);

	return (
		claimedIds.length > 0 ? base.where(notInArray(schema.socialMedia.id, claimedIds)) : base
	).orderBy(schema.socialMedia.name);
}

/** Social media types for the "create new account" picker. */
export async function getSocialMediaTypes(): Promise<
	Array<{ id: string; type: (typeof schema.socialMediaTypesEnum)[number] }>
> {
	return db
		.select({ id: schema.socialMediaTypes.id, type: schema.socialMediaTypes.type })
		.from(schema.socialMediaTypes)
		.orderBy(schema.socialMediaTypes.type);
}

/**
 * The social media account ids covered by a previous report — used to carry the membership over to
 * a new report at creation (accounts only; KPI values start empty each year).
 */
export async function getCarriedOverReportSocialMedia(
	previousReportId: string,
	queryDb: Database | Transaction = db,
): Promise<Array<string>> {
	const rows = await queryDb.query.countryReportSocialMedia.findMany({
		where: { countryReportId: previousReportId },
		columns: { socialMediaId: true },
	});
	return rows.map((row) => row.socialMediaId);
}

/**
 * Social media accounts linked to the country's published version. Country reports must not include
 * social media changes that still exist only in a draft.
 */
export async function getCountrySocialMedia(
	countryDocumentId: string,
	queryDb: Database | Transaction = db,
): Promise<Array<string>> {
	const lifecycle = await queryDb.query.documentLifecycle.findFirst({
		where: { documentId: countryDocumentId },
		columns: { publishedId: true },
	});
	const organisationalUnitId = lifecycle?.publishedId;

	if (organisationalUnitId == null) {
		return [];
	}

	const rows = await queryDb.query.organisationalUnitsToSocialMedia.findMany({
		where: { organisationalUnitId },
		orderBy: { position: "asc" },
		columns: { socialMediaId: true },
	});

	return rows.map((row) => row.socialMediaId);
}

/**
 * Social media accounts linked to the published national consortium versions related to a country
 * during the reporting year. Draft-only consortium accounts and inactive relations are excluded.
 */
export async function getCountryNationalConsortiumSocialMedia(
	countryDocumentId: string,
	year: number,
	queryDb: Database | Transaction = db,
): Promise<Array<string>> {
	const rows = await queryDb
		.selectDistinct({ socialMediaId: schema.organisationalUnitsToSocialMedia.socialMediaId })
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.organisationalUnitsRelations.unitDocumentId),
		)
		.innerJoin(
			schema.organisationalUnits,
			eq(schema.organisationalUnits.id, schema.documentLifecycle.publishedId),
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(
			schema.organisationalUnitsToSocialMedia,
			eq(
				schema.organisationalUnitsToSocialMedia.organisationalUnitId,
				schema.organisationalUnits.id,
			),
		)
		.where(
			and(
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, countryDocumentId),
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				eq(schema.organisationalUnitTypes.type, "national_consortium"),
				sql`
					${schema.organisationalUnitsRelations.duration} && tstzrange (
						MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
						MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
					)
				`,
			),
		);

	return rows.map((row) => row.socialMediaId);
}
