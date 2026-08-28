import * as schema from "@dariah-eric/database/schema";

import { db } from "@/lib/db";
import { alias, and, eq, inArray, or, sql } from "@/lib/db/sql";

/** A compensated contribution role (`reportingCampaignContributionAmounts` keys € amounts by these). */
export type CompensationRole = (typeof schema.reportingCampaignContributionRoleEnum)[number];

/**
 * Country-bound roles: snapshotted from the person↔country relations, edited on the person/unit
 * forms.
 */
export const snapshotCompensationRoles = [
	"national_coordinator",
	"national_coordinator_deputy",
] as const satisfies ReadonlyArray<CompensationRole>;

/** Cross-cutting roles: not inherently tied to a country, so claimed manually in the report. */
export const manualCompensationRoles = [
	"is_chair_of_jrc",
	"is_chair_of_ncc",
	"is_chair_of_wg",
	"is_member_of_jrc",
] as const satisfies ReadonlyArray<CompensationRole>;

const jointResearchCommitteeSlug = "joint-research-committee";
const nationalCoordinatorCommitteeSlug = "national-coordinator-committee";

/**
 * Map a raw person↔org relation (its role + the org it points at) to the compensation role it
 * counts as for a country report, or `null` if it is not a compensated contribution. JRC/NCC are
 * matched by slug explicitly; `is_chair_of` of any working group is a WG chair.
 */
export function classifyCompensationRole(
	rawRoleType: string,
	orgSlug: string,
	orgType: string,
): CompensationRole | null {
	switch (rawRoleType) {
		case "national_coordinator": {
			return "national_coordinator";
		}
		case "national_coordinator_deputy": {
			return "national_coordinator_deputy";
		}
		case "is_chair_of": {
			if (orgSlug === jointResearchCommitteeSlug) {
				return "is_chair_of_jrc";
			}
			if (orgSlug === nationalCoordinatorCommitteeSlug) {
				return "is_chair_of_ncc";
			}
			if (orgType === "working_group") {
				return "is_chair_of_wg";
			}
			return null;
		}
		case "is_member_of": {
			if (orgSlug === jointResearchCommitteeSlug) {
				return "is_member_of_jrc";
			}
			return null;
		}
		default: {
			return null;
		}
	}
}

export interface ContributionCandidate {
	personToOrgUnitId: string;
	personName: string;
	personSlug: string;
	organisationalUnitName: string;
	compensationRole: CompensationRole;
}

/** Shared select + joins resolving a person↔org relation to its current person/org versions + slugs. */
function selectContributionRows() {
	const personLifecycle = alias(schema.documentLifecycle, "contribution_person_lifecycle");
	const orgLifecycle = alias(schema.documentLifecycle, "contribution_org_lifecycle");
	const personEntities = alias(schema.entities, "contribution_person_entities");
	const orgEntities = alias(schema.entities, "contribution_org_entities");
	const personSlugs = alias(schema.slugs, "contribution_person_slugs");
	const orgSlugs = alias(schema.slugs, "contribution_org_slugs");

	return db
		.select({
			personToOrgUnitId: schema.personsToOrganisationalUnits.id,
			personName: schema.persons.name,
			personSlug: personSlugs.value,
			organisationalUnitName: schema.organisationalUnits.name,
			organisationalUnitSlug: orgSlugs.value,
			organisationalUnitType: schema.organisationalUnitTypes.type,
			rawRoleType: schema.personRoleTypes.type,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			personEntities,
			eq(personEntities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(personLifecycle, eq(personLifecycle.documentId, personEntities.id))
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${personLifecycle.draftId}, ${personLifecycle.publishedId})`,
		)
		.innerJoin(personSlugs, eq(personSlugs.entityVersionId, schema.persons.id))
		.innerJoin(
			orgEntities,
			eq(orgEntities.id, schema.personsToOrganisationalUnits.organisationalUnitDocumentId),
		)
		.innerJoin(orgLifecycle, eq(orgLifecycle.documentId, orgEntities.id))
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${orgLifecycle.draftId}, ${orgLifecycle.publishedId})`,
		)
		.innerJoin(orgSlugs, eq(orgSlugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		);
}

function durationOverlapsYear(year: number) {
	return sql`
		${schema.personsToOrganisationalUnits.duration} && tstzrange (
			MAKE_DATE(${year}, 1, 1)::TIMESTAMPTZ,
			MAKE_DATE(${year + 1}, 1, 1)::TIMESTAMPTZ
		)
	`;
}

/**
 * Section 1 (snapshot) candidates: national coordinator + deputy relations at `countryDocumentId`
 * active in the reporting `year`. These are captured into the report and edited on the person
 * form.
 */
export async function getSnapshotContributionCandidates(
	countryDocumentId: string,
	year: number,
): Promise<Array<ContributionCandidate>> {
	const rows = await selectContributionRows()
		.where(
			and(
				inArray(schema.personRoleTypes.type, [...snapshotCompensationRoles]),
				eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, countryDocumentId),
				durationOverlapsYear(year),
			),
		)
		.orderBy(schema.persons.sortName);

	return rows.flatMap((row) => {
		const compensationRole = classifyCompensationRole(
			row.rawRoleType,
			row.organisationalUnitSlug,
			row.organisationalUnitType,
		);
		return compensationRole == null ? [] : [{ ...toCandidate(row), compensationRole }];
	});
}

/**
 * Section 2 (manual) candidates: cross-cutting compensated relations active in the reporting `year`
 * — JRC/NCC/working-group chairs and JRC members. Not country-scoped; the reporter claims the
 * relevant ones for their country.
 */
export async function getManualContributionCandidates(
	year: number,
): Promise<Array<ContributionCandidate>> {
	// Pre-filter by org *type* (the only org columns joined here); the classifier then narrows
	// governance bodies to JRC/NCC by slug and drops the rest (non-JRC chairs, NCC members, …).
	const rows = await selectContributionRows()
		.where(
			and(
				or(
					and(
						eq(schema.personRoleTypes.type, "is_chair_of"),
						inArray(schema.organisationalUnitTypes.type, ["governance_body", "working_group"]),
					),
					and(
						eq(schema.personRoleTypes.type, "is_member_of"),
						eq(schema.organisationalUnitTypes.type, "governance_body"),
					),
				),
				durationOverlapsYear(year),
			),
		)
		.orderBy(schema.persons.sortName);

	return rows.flatMap((row) => {
		const compensationRole = classifyCompensationRole(
			row.rawRoleType,
			row.organisationalUnitSlug,
			row.organisationalUnitType,
		);
		return compensationRole == null ? [] : [{ ...toCandidate(row), compensationRole }];
	});
}

/**
 * Section 2 claims from `previousReportId` whose underlying person↔org relation is still active in
 * the given `year` — used to pre-populate a new report's manual contributions from last year.
 */
export async function getCarriedOverManualContributions(
	previousReportId: string,
	year: number,
): Promise<Array<{ personToOrgUnitId: string; contributionRole: CompensationRole }>> {
	const rows = await db
		.select({
			personToOrgUnitId: schema.countryReportContributions.personToOrgUnitId,
			contributionRole: schema.countryReportContributions.contributionRole,
		})
		.from(schema.countryReportContributions)
		.innerJoin(
			schema.personsToOrganisationalUnits,
			eq(
				schema.personsToOrganisationalUnits.id,
				schema.countryReportContributions.personToOrgUnitId,
			),
		)
		.where(
			and(
				eq(schema.countryReportContributions.countryReportId, previousReportId),
				inArray(schema.countryReportContributions.contributionRole, [...manualCompensationRoles]),
				durationOverlapsYear(year),
			),
		);

	return rows.flatMap((row) =>
		row.contributionRole == null
			? []
			: [{ personToOrgUnitId: row.personToOrgUnitId, contributionRole: row.contributionRole }],
	);
}

export interface ReportContribution {
	id: string;
	personToOrgUnitId: string;
	personName: string;
	personSlug: string;
	organisationalUnitName: string;
	/** Stored role, or classified from the relation for legacy rows captured before it was tracked. */
	compensationRole: CompensationRole | null;
}

/**
 * The report's stored contributions, each resolved to its current person/org versions and to its
 * effective compensation role (the stored `contributionRole`, falling back to classification of the
 * underlying relation for legacy rows). Ordered by person sort name.
 */
export async function getCountryReportContributions(
	countryReportId: string,
): Promise<Array<ReportContribution>> {
	const personLifecycle = alias(schema.documentLifecycle, "report_contribution_person_lifecycle");
	const orgLifecycle = alias(schema.documentLifecycle, "report_contribution_org_lifecycle");
	const personEntities = alias(schema.entities, "report_contribution_person_entities");
	const orgEntities = alias(schema.entities, "report_contribution_org_entities");
	const personSlugs = alias(schema.slugs, "report_contribution_person_slugs");
	const orgSlugs = alias(schema.slugs, "report_contribution_org_slugs");

	const rows = await db
		.select({
			id: schema.countryReportContributions.id,
			personToOrgUnitId: schema.countryReportContributions.personToOrgUnitId,
			storedRole: schema.countryReportContributions.contributionRole,
			personName: schema.persons.name,
			personSlug: personSlugs.value,
			organisationalUnitName: schema.organisationalUnits.name,
			organisationalUnitSlug: orgSlugs.value,
			organisationalUnitType: schema.organisationalUnitTypes.type,
			rawRoleType: schema.personRoleTypes.type,
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
			personEntities,
			eq(personEntities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(personLifecycle, eq(personLifecycle.documentId, personEntities.id))
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${personLifecycle.draftId}, ${personLifecycle.publishedId})`,
		)
		.innerJoin(personSlugs, eq(personSlugs.entityVersionId, schema.persons.id))
		.innerJoin(
			orgEntities,
			eq(orgEntities.id, schema.personsToOrganisationalUnits.organisationalUnitDocumentId),
		)
		.innerJoin(orgLifecycle, eq(orgLifecycle.documentId, orgEntities.id))
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${orgLifecycle.draftId}, ${orgLifecycle.publishedId})`,
		)
		.innerJoin(orgSlugs, eq(orgSlugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.where(eq(schema.countryReportContributions.countryReportId, countryReportId))
		.orderBy(schema.persons.sortName);

	return rows.map((row) => {
		const compensationRole =
			row.storedRole ??
			classifyCompensationRole(
				row.rawRoleType,
				row.organisationalUnitSlug,
				row.organisationalUnitType,
			);
		return {
			id: row.id,
			personToOrgUnitId: row.personToOrgUnitId,
			personName: row.personName,
			personSlug: row.personSlug,
			organisationalUnitName: row.organisationalUnitName,
			compensationRole,
		};
	});
}

export function isSnapshotRole(role: CompensationRole | null): boolean {
	return (
		role != null && (snapshotCompensationRoles as ReadonlyArray<CompensationRole>).includes(role)
	);
}

function isManualRole(role: CompensationRole): boolean {
	return (manualCompensationRoles as ReadonlyArray<CompensationRole>).includes(role);
}

/**
 * Resolve a single person↔org relation as an eligible _manual_ (Section 2) contribution for the
 * given report — i.e. it classifies to a cross-cutting compensation role and is active in the
 * report's campaign year. Returns `null` if it is not eligible. Used to validate + classify a
 * manual claim.
 */
export async function getManualContributionCandidateForReport(
	countryReportId: string,
	personToOrgUnitId: string,
): Promise<ContributionCandidate | null> {
	const report = await db.query.countryReports.findFirst({
		where: { id: countryReportId },
		columns: {},
		with: { campaign: { columns: { year: true } } },
	});
	if (report == null) {
		return null;
	}

	const rows = await selectContributionRows()
		.where(
			and(
				eq(schema.personsToOrganisationalUnits.id, personToOrgUnitId),
				durationOverlapsYear(report.campaign.year),
			),
		)
		.limit(1);

	const row = rows[0];
	if (row == null) {
		return null;
	}

	const compensationRole = classifyCompensationRole(
		row.rawRoleType,
		row.organisationalUnitSlug,
		row.organisationalUnitType,
	);
	if (compensationRole == null || !isManualRole(compensationRole)) {
		return null;
	}

	return { ...toCandidate(row), compensationRole };
}

function toCandidate(row: {
	personToOrgUnitId: string;
	personName: string;
	personSlug: string;
	organisationalUnitName: string;
}): Omit<ContributionCandidate, "compensationRole"> {
	return {
		personToOrgUnitId: row.personToOrgUnitId,
		personName: row.personName,
		personSlug: row.personSlug,
		organisationalUnitName: row.organisationalUnitName,
	};
}
