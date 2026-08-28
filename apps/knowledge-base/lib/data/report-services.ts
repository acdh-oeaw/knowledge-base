import * as schema from "@dariah-eric/database/schema";

import { type Database, type Transaction, db } from "@/lib/db";
import { and, eq, notInArray, sql } from "@/lib/db/sql";

export type ServiceKpiCategory = (typeof schema.serviceKpiCategoryEnum)[number];

export interface CountryService {
	id: string;
	name: string;
}

/** Deduplicates the current-consortium and previous-report candidates used to seed a new report. */
export function getCountryReportServiceSeedIds(
	consortiumServices: ReadonlyArray<CountryService>,
	carriedServices: ReadonlyArray<CountryService>,
): Array<string> {
	return [...new Set([...consortiumServices, ...carriedServices].map((service) => service.id))];
}

/**
 * Live services attached to a country's national consortium during a campaign year. The consortium
 * relation is document-level and must overlap the reporting year.
 */
export async function getCountryLiveConsortiumServices(
	countryDocumentId: string,
	year: number,
	queryDb: Database | Transaction = db,
): Promise<Array<CountryService>> {
	return queryDb
		.selectDistinct({ id: schema.services.id, name: schema.services.name })
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
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(
			schema.servicesToOrganisationalUnits,
			eq(
				schema.servicesToOrganisationalUnits.organisationalUnitDocumentId,
				schema.organisationalUnitsRelations.unitDocumentId,
			),
		)
		.innerJoin(
			schema.services,
			eq(schema.services.id, schema.servicesToOrganisationalUnits.serviceId),
		)
		.innerJoin(schema.serviceStatuses, eq(schema.serviceStatuses.id, schema.services.statusId))
		.where(
			and(
				eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, countryDocumentId),
				eq(schema.organisationalUnitStatus.status, "is_national_consortium_of"),
				eq(
					schema.organisationalUnitTypes.type,
					"national_consortium" as typeof schema.organisationalUnitTypes.$inferSelect.type,
				),
				eq(schema.serviceStatuses.status, "live"),
				sql`
					${schema.organisationalUnitsRelations.duration} && tstzrange (
						MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
						MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
					)
				`,
			),
		)
		.orderBy(schema.services.name);
}

/** Live service memberships carried by a previous country report. */
export async function getCarriedOverReportServices(
	previousReportId: string,
	queryDb: Database | Transaction = db,
): Promise<Array<CountryService>> {
	return queryDb
		.select({ id: schema.services.id, name: schema.services.name })
		.from(schema.countryReportServices)
		.innerJoin(schema.services, eq(schema.services.id, schema.countryReportServices.serviceId))
		.innerJoin(schema.serviceStatuses, eq(schema.serviceStatuses.id, schema.services.statusId))
		.where(
			and(
				eq(schema.countryReportServices.countryReportId, previousReportId),
				eq(schema.serviceStatuses.status, "live"),
			),
		)
		.orderBy(schema.services.name);
}

export interface ReportServiceWithKpis extends CountryService {
	/** The membership row id (`country_report_services.id`), used to remove the service. */
	membershipId: string;
	kpis: Array<{ kpi: ServiceKpiCategory; value: number }>;
}

/** The services covered by a report, together with KPI values recorded for each one. */
export async function getCountryReportServices(
	countryReportId: string,
): Promise<Array<ReportServiceWithKpis>> {
	const memberships = await db.query.countryReportServices.findMany({
		where: { countryReportId },
		columns: { id: true, serviceId: true },
		with: { service: { columns: { name: true } } },
	});

	const kpiRows = await db.query.countryReportServiceKpis.findMany({
		where: { countryReportId },
		columns: { serviceId: true, kpi: true, value: true },
	});
	const kpisByService = new Map<string, Array<{ kpi: ServiceKpiCategory; value: number }>>();
	for (const row of kpiRows) {
		const list = kpisByService.get(row.serviceId) ?? [];
		list.push({ kpi: row.kpi, value: row.value });
		kpisByService.set(row.serviceId, list);
	}

	return memberships
		.map((membership) => {
			return {
				id: membership.serviceId,
				membershipId: membership.id,
				name: membership.service.name,
				kpis: kpisByService.get(membership.serviceId) ?? [],
			};
		})
		.toSorted((a, b) => a.name.localeCompare(b.name));
}

export interface AvailableReportService {
	id: string;
	name: string;
}

/** All live services not already covered by the report, for the add-existing picker. */
export async function getAvailableServicesForReport(
	countryReportId: string,
): Promise<Array<AvailableReportService>> {
	const memberships = await db.query.countryReportServices.findMany({
		where: { countryReportId },
		columns: { serviceId: true },
	});
	const claimedIds = memberships.map((membership) => membership.serviceId);

	const conditions = [eq(schema.serviceStatuses.status, "live")];
	if (claimedIds.length > 0) {
		conditions.push(notInArray(schema.services.id, claimedIds));
	}

	return db
		.select({ id: schema.services.id, name: schema.services.name })
		.from(schema.services)
		.innerJoin(schema.serviceStatuses, eq(schema.serviceStatuses.id, schema.services.statusId))
		.where(and(...conditions))
		.orderBy(schema.services.name);
}
