import {
	type CountryMembershipCheckResult,
	type CountryMembershipFinding,
	type CountryMembershipFindingKind,
	type HeadingHierarchyCheckResult,
	type HeadingHierarchyFinding,
	type HeadingHierarchyFindingKind,
	type InactiveUnitRelationCheckResult,
	type InactiveUnitRelationFinding,
	type MutuallyExclusiveFindingKind,
	type MutuallyExclusiveUnitRelationCheckResult,
	type MutuallyExclusiveUnitRelationFinding,
	type PairedRelationCheckResult,
	type PairedRelationFinding,
	type PairedRelationFindingKind,
	type RelationInterval,
	type RelationSide,
	type UnitRelationRequirementCheckResult,
	type UnitRelationRequirementFinding,
	type WebAddressCheckResult,
	type WebAddressFinding,
	type WebAddressFindingKind,
	type WebAddressSource,
	checkCountryMembership,
	checkHeadingHierarchy,
	checkInactiveUnitRelations,
	checkMutuallyExclusiveUnitRelations,
	checkPairedRelations,
	checkUnitRelationRequirements,
	checkWebAddresses,
} from "@dariah-eric/database/integrity-service";

import { db } from "@/lib/db";

export type {
	CountryMembershipCheckResult,
	CountryMembershipFinding,
	CountryMembershipFindingKind,
	HeadingHierarchyCheckResult,
	HeadingHierarchyFinding,
	HeadingHierarchyFindingKind,
	InactiveUnitRelationCheckResult,
	InactiveUnitRelationFinding,
	MutuallyExclusiveFindingKind,
	MutuallyExclusiveUnitRelationCheckResult,
	MutuallyExclusiveUnitRelationFinding,
	PairedRelationCheckResult,
	PairedRelationFinding,
	PairedRelationFindingKind,
	RelationInterval,
	RelationSide,
	UnitRelationRequirementCheckResult,
	UnitRelationRequirementFinding,
	WebAddressCheckResult,
	WebAddressFinding,
	WebAddressFindingKind,
	WebAddressSource,
};

/**
 * Runs the paired-relation data-integrity checks (e.g. a national representative role and the
 * matching General Assembly membership must both exist with the same duration). Checked in both
 * directions. Same checks as the `@dariah-eric/audit` cli scripts.
 */
export async function getDataIntegrityFindings(): Promise<PairedRelationCheckResult> {
	return checkPairedRelations(db);
}

/**
 * Runs the unit-relation-requirement checks (e.g. every institution that is a partner institution
 * or cooperating partner of DARIAH-EU must also record which country it is located in). Same checks
 * as the `@dariah-eric/audit` cli scripts.
 */
export async function getUnitRelationRequirementFindings(): Promise<UnitRelationRequirementCheckResult> {
	return checkUnitRelationRequirements(db);
}

/**
 * Runs the inactive-unit-relation checks (e.g. a working group whose `is_part_of` relation to an
 * ERIC has ended must not still have open chair/vice-chair/member/contact relations). Same checks
 * as the `@dariah-eric/audit` cli scripts.
 */
export async function getInactiveUnitRelationFindings(): Promise<InactiveUnitRelationCheckResult> {
	return checkInactiveUnitRelations(db);
}

/**
 * Runs the mutually-exclusive-unit-relation checks (e.g. a national coordinating institution is by
 * definition a partner institution, so both relations must not be recorded for the same period).
 * Same checks as the `@dariah-eric/audit` cli scripts.
 */
export async function getMutuallyExclusiveUnitRelationFindings(): Promise<MutuallyExclusiveUnitRelationCheckResult> {
	return checkMutuallyExclusiveUnitRelations(db);
}

/**
 * Runs the country-membership checks (e.g. a partner institution must be located in a country which
 * is a member or observer of DARIAH-EU for that period, while a cooperating partner must be located
 * in one which is not). Same checks as the `@dariah-eric/audit` cli scripts.
 */
export async function getCountryMembershipFindings(): Promise<CountryMembershipCheckResult> {
	return checkCountryMembership(db);
}

/**
 * Runs the rich-text heading-hierarchy check (e.g. a field must open at `h2` and must not skip from
 * `h2` straight to `h4`, and no heading may fall outside the editor's `h2`–`h4` range). Reporting
 * only — the fixes require editorial judgement. Same check as the `@dariah-eric/audit` cli
 * scripts.
 */
export async function getHeadingHierarchyFindings(): Promise<HeadingHierarchyCheckResult> {
	return checkHeadingHierarchy(db);
}

/**
 * Runs the web-address checks (e.g. an event website, a social-media URL, or a document/policy link
 * must be a valid `https` URL — a social-media entry may instead be an email address). Reporting
 * only — the correct address needs an editor. Same check as the `@dariah-eric/audit` cli scripts.
 */
export async function getWebAddressFindings(): Promise<WebAddressCheckResult> {
	return checkWebAddresses(db);
}
