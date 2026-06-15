import { assert } from "@acdh-oeaw/lib";
import * as schema from "@acdh-knowledge-base/database/schema";

import { db } from "@/lib/db";
import { and, eq, sql } from "@/lib/db/sql";

type BreadcrumbSegments = Array<string>;

function isUuid(value: string): boolean {
	return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/iu.test(value);
}

function formatReportLabel(name: string, year: number): string {
	return `${name} ${year}`;
}

async function getReportingCampaignLabel(id: string): Promise<string | null> {
	const campaign = await db.query.reportingCampaigns.findFirst({
		where: { id },
		columns: { year: true },
	});

	return campaign == null ? null : `Campaign ${campaign.year}`;
}

async function getCountryReportLabel(id: string): Promise<string | null> {
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
	return formatReportLabel(report.country.name, report.campaign.year);
}

async function getWorkingGroupReportLabel(id: string): Promise<string | null> {
	const report = await db.query.workingGroupReports.findFirst({
		where: { id },
		columns: { id: true },
		with: {
			campaign: { columns: { year: true } },
			workingGroup: { columns: { name: true } },
		},
	});

	if (report == null) {
		return null;
	}

	// A working group report always references a published working group.
	assert(report.workingGroup, "Working group report is missing its published working group.");
	return formatReportLabel(report.workingGroup.name, report.campaign.year);
}

async function getCountryReportLabelByRoute(year: string, slug: string): Promise<string | null> {
	const campaignYear = Number(year);

	if (!Number.isInteger(campaignYear)) {
		return null;
	}

	const report = await db
		.select({ name: schema.organisationalUnits.name })
		.from(schema.countryReports)
		.innerJoin(
			schema.reportingCampaigns,
			eq(schema.reportingCampaigns.id, schema.countryReports.campaignId),
		)
		.innerJoin(schema.entities, eq(schema.entities.id, schema.countryReports.countryDocumentId))
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(and(eq(schema.reportingCampaigns.year, campaignYear), eq(schema.entities.slug, slug)))
		.limit(1);

	return report[0]?.name ?? null;
}

async function getWorkingGroupReportLabelByRoute(
	year: string,
	slug: string,
): Promise<string | null> {
	const campaignYear = Number(year);

	if (!Number.isInteger(campaignYear)) {
		return null;
	}

	const report = await db
		.select({ name: schema.organisationalUnits.name })
		.from(schema.workingGroupReports)
		.innerJoin(
			schema.reportingCampaigns,
			eq(schema.reportingCampaigns.id, schema.workingGroupReports.campaignId),
		)
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
		.where(and(eq(schema.reportingCampaigns.year, campaignYear), eq(schema.entities.slug, slug)))
		.limit(1);

	return report[0]?.name ?? null;
}

function getDynamicBreadcrumbResolver(
	segments: BreadcrumbSegments,
): null | { id: string; resolve: (id: string) => Promise<string | null> } {
	const id = segments[2];

	if (id == null || !isUuid(id)) {
		return null;
	}

	if (
		segments[0] === "administrator" &&
		segments[1] === "reporting-campaigns" &&
		segments[2] != null
	) {
		return { id, resolve: getReportingCampaignLabel };
	}

	if (segments[1] === "country-reports" && segments[2] != null) {
		return { id, resolve: getCountryReportLabel };
	}

	if (segments[1] === "working-group-reports" && segments[2] != null) {
		return { id, resolve: getWorkingGroupReportLabel };
	}

	return null;
}

export async function getBreadcrumbLabels(
	segments: BreadcrumbSegments,
): Promise<Record<string, string>> {
	if (
		segments[0] === "reporting" &&
		segments[1] === "country-reports" &&
		segments[2] != null &&
		segments[3] != null
	) {
		const label = await getCountryReportLabelByRoute(segments[2], segments[3]);

		return label == null ? {} : { [segments[3]]: label };
	}

	if (
		segments[0] === "reporting" &&
		segments[1] === "working-group-reports" &&
		segments[2] != null &&
		segments[3] != null
	) {
		const label = await getWorkingGroupReportLabelByRoute(segments[2], segments[3]);

		return label == null ? {} : { [segments[3]]: label };
	}

	const resolver = getDynamicBreadcrumbResolver(segments);

	if (resolver == null) {
		return {};
	}

	const label = await resolver.resolve(resolver.id);

	return label == null ? {} : { [resolver.id]: label };
}
