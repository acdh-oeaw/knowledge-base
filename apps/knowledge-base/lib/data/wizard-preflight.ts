import {
	type Interval,
	countryMembershipRules,
	inactiveUnitRelationRules,
	intersectIntervals,
	mutuallyExclusiveUnitRelationRules,
	pairedRelationRules,
	subtractIntervals,
	toRawIntervals,
	toSerializableIntervals,
} from "@dariah-eric/database/integrity-service";
import * as schema from "@dariah-eric/database/schema";

import type {
	WizardPlanItem,
	WizardPreflight,
	WizardWarning,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-plan";
import {
	type CountryRoleType,
	countryRoleDefaultCounterpartRoles,
	countryRoleRuleByRoleType,
} from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-registry";
import { type Database, type Transaction, db } from "@/lib/db";
import { and, eq, inArray, sql } from "@/lib/db/sql";

/**
 * Evaluates the data-integrity rules against the choices made in a guided form, _before_ anything
 * is written, so the admin sees the same verdict the maintenance dashboard would give them
 * afterwards.
 *
 * The rules live in `@dariah-eric/database/integrity-service` and are not restated here: this
 * module fetches the facts each rule needs and feeds them to the rule's own declaration. What it
 * adds is the "does this row already exist?" question the retrospective checks never have to ask.
 */

export type OrganisationalUnitStatusType = (typeof schema.organisationalUnitStatusEnum)[number];

/** One relation a unit already holds, in the shape the interval helpers expect. */
interface ExistingUnitRelation {
	id: string;
	statusType: OrganisationalUnitStatusType;
	relatedUnitDocumentId: string;
	start: Date;
	end?: Date;
}

/** Every unit-to-unit relation currently recorded on `unitDocumentId`, whatever its status. */
export async function getExistingUnitRelations(
	client: Database | Transaction,
	unitDocumentId: string,
): Promise<Array<ExistingUnitRelation>> {
	const rows = await client
		.select({
			id: schema.organisationalUnitsRelations.id,
			statusType: schema.organisationalUnitStatus.status,
			relatedUnitDocumentId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
			duration: schema.organisationalUnitsRelations.duration,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.where(eq(schema.organisationalUnitsRelations.unitDocumentId, unitDocumentId));

	return rows.map((row) => {
		return {
			id: row.id,
			statusType: row.statusType,
			relatedUnitDocumentId: row.relatedUnitDocumentId,
			start: row.duration.start,
			...(row.duration.end != null ? { end: row.duration.end } : {}),
		};
	});
}

export interface UnitReference {
	documentId: string;
	name: string;
	slug: string;
	/** The organisational-unit subtype, e.g. `country` — several rules are pinned to one. */
	type: (typeof schema.organisationalUnitTypesEnum)[number];
}

/** Resolves an organisational unit to its document id and current (draft-or-published) name. */
export async function getUnitReferenceBySlug(
	client: Database | Transaction,
	slug: string,
): Promise<UnitReference | null> {
	const row = await client
		.select({
			documentId: schema.documentLifecycle.documentId,
			name: schema.organisationalUnits.name,
			slug: schema.slugs.value,
			type: schema.organisationalUnitTypes.type,
		})
		.from(schema.entities)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.entities.id),
		)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.where(eq(schema.slugs.value, slug))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return row;
}

export async function getUnitReferenceByDocumentId(
	client: Database | Transaction,
	documentId: string,
): Promise<UnitReference | null> {
	const row = await client
		.select({
			documentId: schema.documentLifecycle.documentId,
			name: schema.organisationalUnits.name,
			slug: schema.slugs.value,
			type: schema.organisationalUnitTypes.type,
		})
		.from(schema.documentLifecycle)
		.innerJoin(
			schema.organisationalUnits,
			sql`${schema.organisationalUnits.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.organisationalUnits.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		)
		.innerJoin(schema.entities, eq(schema.entities.id, schema.documentLifecycle.documentId))
		.where(eq(schema.documentLifecycle.documentId, documentId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return row;
}

/** The `organisationalUnitStatus` rows for the given status names, keyed by name. */
export async function getUnitStatusIdsByType(
	client: Database | Transaction,
	statusTypes: ReadonlyArray<OrganisationalUnitStatusType>,
): Promise<Map<OrganisationalUnitStatusType, string>> {
	if (statusTypes.length === 0) {
		return new Map();
	}

	const rows = await client
		.select({
			id: schema.organisationalUnitStatus.id,
			status: schema.organisationalUnitStatus.status,
		})
		.from(schema.organisationalUnitStatus)
		.where(inArray(schema.organisationalUnitStatus.status, [...statusTypes]));

	return new Map(rows.map((row) => [row.status, row.id] as const));
}

/** The statuses an institution may hold towards an eric, in the order the wizard offers them. */
export const partnerInstitutionStatusTypes = [
	"is_partner_institution_of",
	"is_national_coordinating_institution_in",
	"is_national_representative_institution_in",
	"is_cooperating_partner_of",
] as const satisfies ReadonlyArray<OrganisationalUnitStatusType>;

export type PartnerInstitutionStatusType = (typeof partnerInstitutionStatusTypes)[number];

export interface PartnerInstitutionPreflightInput {
	/** Document id of the institution, or `null` when the wizard will create a new one. */
	institutionDocumentId: string | null;
	/** Name of the institution — the picked one's, or the one being typed for a new one. */
	institutionName: string;
	countryDocumentId: string;
	/** ISO date the institution is recorded as located in the country from. */
	locatedInStart: string;
	statusType: PartnerInstitutionStatusType;
	statusStart: string;
	statusEnd: string | null;
	lifecycle: "draft" | "published";
}

function toInterval(start: string, end: string | null): Interval {
	return {
		start: new Date(start).getTime(),
		end: end == null ? Infinity : new Date(end).getTime(),
	};
}

/** Whether an existing relation of the same shape already covers the requested period. */
function coversPeriod(existing: Array<ExistingUnitRelation>, requested: Interval): boolean {
	const covered = subtractIntervals(
		[requested],
		toRawIntervals(
			existing.map((relation) => {
				return { start: relation.start, ...(relation.end != null ? { end: relation.end } : {}) };
			}),
		),
	);

	return covered.length === 0;
}

export async function getPartnerInstitutionPreflight(
	input: PartnerInstitutionPreflightInput,
): Promise<WizardPreflight> {
	const items: Array<WizardPlanItem> = [];
	const warnings: Array<WizardWarning> = [];

	const [country, eric] = await Promise.all([
		getUnitReferenceByDocumentId(db, input.countryDocumentId),
		getUnitReferenceBySlug(db, "dariah-eu"),
	]);

	// Without the eric document there is nothing to relate the institution to, and the rules pinned
	// to `dariah-eu` cannot be evaluated either.
	if (country == null || eric == null) {
		return { items, warnings };
	}

	const existing =
		input.institutionDocumentId == null
			? []
			: await getExistingUnitRelations(db, input.institutionDocumentId);

	if (input.institutionDocumentId == null) {
		items.push({
			id: "institution",
			status: "create",
			kind: "entity",
			entityType: "institution",
			name: input.institutionName,
			lifecycle: input.lifecycle,
		});
	}

	const locatedInPeriod = toInterval(input.locatedInStart, null);
	const locatedInExisting = existing.filter(
		(relation) =>
			relation.statusType === "is_located_in" &&
			relation.relatedUnitDocumentId === input.countryDocumentId,
	);

	items.push({
		id: "is_located_in",
		status: coversPeriod(locatedInExisting, locatedInPeriod) ? "skip" : "create",
		kind: "unit_relation",
		unitName: input.institutionName,
		relationType: "is_located_in",
		relatedUnitName: country.name,
		start: input.locatedInStart,
		end: null,
	});

	const statusPeriod = toInterval(input.statusStart, input.statusEnd);
	const statusExisting = existing.filter(
		(relation) =>
			relation.statusType === input.statusType &&
			relation.relatedUnitDocumentId === eric.documentId,
	);

	items.push({
		id: input.statusType,
		status: coversPeriod(statusExisting, statusPeriod) ? "skip" : "create",
		kind: "unit_relation",
		unitName: input.institutionName,
		relationType: input.statusType,
		relatedUnitName: eric.name,
		start: input.statusStart,
		end: input.statusEnd,
	});

	warnings.push(
		...(await getCountryMembershipWarnings({
			country,
			eric,
			institutionName: input.institutionName,
			locatedInPeriod,
			statusPeriod,
			statusType: input.statusType,
		})),
	);

	warnings.push(
		...getMutuallyExclusiveWarnings({
			eric,
			existing,
			institutionName: input.institutionName,
			statusPeriod,
			statusType: input.statusType,
		}),
	);

	return { items, warnings };
}

interface CountryMembershipWarningParams {
	country: UnitReference;
	eric: UnitReference;
	institutionName: string;
	locatedInPeriod: Interval;
	statusPeriod: Interval;
	statusType: PartnerInstitutionStatusType;
}

/**
 * Applies `countryMembershipRules` to the choices made so far. The rule only judges the period the
 * institution _both_ holds the status and sits in the country, exactly as
 * `buildCountryMembershipFindings` does for existing data.
 */
async function getCountryMembershipWarnings(
	params: Readonly<CountryMembershipWarningParams>,
): Promise<Array<WizardWarning>> {
	const { country, eric, institutionName, locatedInPeriod, statusPeriod, statusType } = params;

	const warnings: Array<WizardWarning> = [];

	const applicable = intersectIntervals([statusPeriod], [locatedInPeriod]);
	if (applicable.length === 0) {
		return warnings;
	}

	const countryRelations = await getExistingUnitRelations(db, country.documentId);

	for (const rule of countryMembershipRules) {
		if (
			!(rule.trigger.statuses as ReadonlyArray<string>).includes(statusType) ||
			rule.trigger.relatedUnitSlug !== eric.slug ||
			rule.country.relatedUnitSlug !== eric.slug
		) {
			continue;
		}

		const countryStatus = toRawIntervals(
			countryRelations
				.filter(
					(relation) =>
						(rule.country.statuses as ReadonlyArray<string>).includes(relation.statusType) &&
						relation.relatedUnitDocumentId === eric.documentId,
				)
				.map((relation) => {
					return { start: relation.start, ...(relation.end != null ? { end: relation.end } : {}) };
				}),
		);

		const periods =
			rule.country.requirement === "required"
				? subtractIntervals(applicable, countryStatus)
				: intersectIntervals(applicable, countryStatus);

		if (periods.length === 0) {
			continue;
		}

		warnings.push({
			id: `country-membership:${rule.name}`,
			severity: "warning",
			code: rule.country.requirement === "required" ? "country_not_member" : "country_is_member",
			rule: rule.name,
			values: { country: country.name, institution: institutionName, relation: statusType },
			periods: toSerializableIntervals(periods),
		});
	}

	return warnings;
}

interface MutuallyExclusiveWarningParams {
	eric: UnitReference;
	existing: Array<ExistingUnitRelation>;
	institutionName: string;
	statusPeriod: Interval;
	statusType: PartnerInstitutionStatusType;
}

/**
 * Applies `mutuallyExclusiveUnitRelationRules` to the status about to be recorded. Both sides of
 * each rule are checked, because the admin may be adding either one to a unit that already holds
 * the other.
 */
function getMutuallyExclusiveWarnings(
	params: Readonly<MutuallyExclusiveWarningParams>,
): Array<WizardWarning> {
	const { eric, existing, institutionName, statusPeriod, statusType } = params;

	const warnings: Array<WizardWarning> = [];

	for (const rule of mutuallyExclusiveUnitRelationRules) {
		for (const [side, other] of [
			[rule.a, rule.b],
			[rule.b, rule.a],
		] as const) {
			if (
				!(side.statuses as ReadonlyArray<string>).includes(statusType) ||
				side.relatedUnitSlug !== eric.slug ||
				other.relatedUnitSlug !== eric.slug
			) {
				continue;
			}

			const conflicting = existing.filter(
				(relation) =>
					(other.statuses as ReadonlyArray<string>).includes(relation.statusType) &&
					relation.relatedUnitDocumentId === eric.documentId,
			);

			const overlap = intersectIntervals(
				[statusPeriod],
				toRawIntervals(
					conflicting.map((relation) => {
						return {
							start: relation.start,
							...(relation.end != null ? { end: relation.end } : {}),
						};
					}),
				),
			);

			if (overlap.length === 0) {
				continue;
			}

			warnings.push({
				id: `mutually-exclusive:${rule.name}:${side.label}`,
				severity: rule.kind === "contradictory" ? "warning" : "info",
				code: rule.kind === "contradictory" ? "relation_conflicts" : "relation_implies_other",
				rule: rule.name,
				values: { other: other.label, relation: side.label, unit: institutionName },
				periods: toSerializableIntervals(overlap),
			});
		}
	}

	return warnings;
}

export type PersonRoleType = (typeof schema.personRoleTypesEnum)[number];

/** One person-to-unit relation already recorded, in the shape the interval helpers expect. */
interface ExistingPersonRelation {
	id: string;
	roleType: PersonRoleType;
	organisationalUnitDocumentId: string;
	start: Date;
	end?: Date;
}

export async function getExistingPersonRelations(
	client: Database | Transaction,
	personDocumentId: string,
): Promise<Array<ExistingPersonRelation>> {
	const rows = await client
		.select({
			id: schema.personsToOrganisationalUnits.id,
			roleType: schema.personRoleTypes.type,
			organisationalUnitDocumentId:
				schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.where(eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId));

	return rows.map((row) => {
		return {
			id: row.id,
			roleType: row.roleType,
			organisationalUnitDocumentId: row.organisationalUnitDocumentId,
			start: row.duration.start,
			...(row.duration.end != null ? { end: row.duration.end } : {}),
		};
	});
}

/** The `person_role_types` rows for the given role names, keyed by name. */
export async function getPersonRoleTypeIdsByType(
	client: Database | Transaction,
	roleTypes: ReadonlyArray<PersonRoleType>,
): Promise<Map<PersonRoleType, string>> {
	if (roleTypes.length === 0) {
		return new Map();
	}

	const rows = await client
		.select({ id: schema.personRoleTypes.id, type: schema.personRoleTypes.type })
		.from(schema.personRoleTypes)
		.where(inArray(schema.personRoleTypes.type, [...roleTypes]));

	return new Map(rows.map((row) => [row.type, row.id] as const));
}

export interface CountryRolePreflightInput {
	/** Document id of the person, or `null` when the wizard will create a new one. */
	personDocumentId: string | null;
	personName: string;
	countryDocumentId: string;
	roleType: CountryRoleType;
	/** Which of the paired rule's accepted counterpart roles to record. Null means the default. */
	counterpartRoleType: PersonRoleType | null;
	start: string;
	end: string | null;
	lifecycle: "draft" | "published";
}

/**
 * The counterpart a paired-relation rule demands, resolved against the database.
 *
 * Shared by the preflight and the submit action so both agree on which row is meant: the rule names
 * a governance body by slug and the set of roles that satisfy it, and the caller picks which of
 * those to create.
 */
export interface CountryRoleCounterpart {
	rule: string;
	unit: UnitReference;
	/** Every role that satisfies the rule's counterpart side. */
	acceptedRoleTypes: ReadonlyArray<PersonRoleType>;
	/** The role a missing counterpart is created as — the caller's choice, or the default. */
	createAsRoleType: PersonRoleType;
	/** The existing row to widen, when one overlaps but does not cover the requested period. */
	rowToWiden: { id: string; start: Date; end?: Date } | null;
	/** Whether an existing counterpart already covers the requested period. */
	isCovered: boolean;
	/**
	 * The role of the relation that already covers the period, when one does. May differ from
	 * `createAsRoleType` — a coordinator who already chairs the committee satisfies the rule without
	 * a membership row — so the review step can name what is actually on record.
	 */
	coveringRoleType: PersonRoleType | null;
}

export interface CountryRoleCounterpartOption {
	/** Every role the paired rule accepts, in the order the rule lists them. */
	options: Array<PersonRoleType>;
	/** The one preselected, so the form never depends on the rule's array order. */
	defaultRoleType: PersonRoleType;
}

/**
 * The counterpart roles each country role may be recorded as, read from its paired rule so the form
 * offers exactly what the rule accepts — membership alone for the General Assembly, membership,
 * chair, or vice-chair for the National Coordinator Committee.
 */
export function getCountryRoleCounterpartOptions(): Record<
	CountryRoleType,
	CountryRoleCounterpartOption
> {
	const result = {} as Record<CountryRoleType, CountryRoleCounterpartOption>;

	for (const roleType of Object.keys(countryRoleRuleByRoleType) as Array<CountryRoleType>) {
		const ruleName = countryRoleRuleByRoleType[roleType];
		const rule = pairedRelationRules.find((entry) => entry.name === ruleName);

		result[roleType] = {
			options: [...(rule?.b.roleTypes ?? [])],
			defaultRoleType: countryRoleDefaultCounterpartRoles[ruleName],
		};
	}

	return result;
}

export async function resolveCountryRoleCounterpart(
	client: Database | Transaction,
	roleType: CountryRoleType,
	existing: Array<ExistingPersonRelation>,
	requested: Interval,
	/**
	 * Which accepted role to create. Ignored when the rule does not accept it, so a stale or
	 * hand-crafted request can never write a role that fails to satisfy the rule.
	 */
	requestedCounterpartRoleType?: PersonRoleType | null,
): Promise<CountryRoleCounterpart | null> {
	const ruleName = countryRoleRuleByRoleType[roleType];
	const rule = pairedRelationRules.find((entry) => entry.name === ruleName);

	// `unitSlug` is what pins the counterpart to a governance body; without it there is no row to
	// create. The coverage test keeps this from happening silently.
	if (rule?.b.unitSlug == null) {
		return null;
	}

	const unit = await getUnitReferenceBySlug(client, rule.b.unitSlug);
	if (unit == null) {
		return null;
	}

	const candidates = existing.filter(
		(relation) =>
			(rule.b.roleTypes as ReadonlyArray<string>).includes(relation.roleType) &&
			relation.organisationalUnitDocumentId === unit.documentId,
	);

	// Any accepted role satisfies the rule, so coverage is judged against all of them: a coordinator
	// who already chairs the committee needs no membership row on top, and adding one would leave two
	// open roles on the same body for the same period.
	const isCovered =
		candidates.length > 0 &&
		subtractIntervals(
			[requested],
			toRawIntervals(
				candidates.map((relation) => {
					return { start: relation.start, ...(relation.end != null ? { end: relation.end } : {}) };
				}),
			),
		).length === 0;

	const overlapping = candidates.find(
		(relation) =>
			intersectIntervals(
				[requested],
				toRawIntervals([
					{ start: relation.start, ...(relation.end != null ? { end: relation.end } : {}) },
				]),
			).length > 0,
	);

	const createAsRoleType =
		requestedCounterpartRoleType != null &&
		(rule.b.roleTypes as ReadonlyArray<string>).includes(requestedCounterpartRoleType)
			? requestedCounterpartRoleType
			: countryRoleDefaultCounterpartRoles[ruleName];

	return {
		rule: rule.name,
		unit,
		acceptedRoleTypes: rule.b.roleTypes,
		createAsRoleType,
		rowToWiden:
			!isCovered && overlapping != null
				? {
						id: overlapping.id,
						start: overlapping.start,
						...(overlapping.end != null ? { end: overlapping.end } : {}),
					}
				: null,
		isCovered,
		coveringRoleType: isCovered ? (overlapping?.roleType ?? null) : null,
	};
}

/**
 * An open country-role appointment, offered by the wizard's end mode.
 *
 * Only open ones: an appointment that already has an end date is not something to end, and the
 * wizard deliberately does not re-date past appointments — that is the edit dialog's job.
 */
export interface CountryRoleAppointment {
	id: string;
	roleType: CountryRoleType;
	countryDocumentId: string;
	countryName: string;
	start: string;
}

export async function getOpenCountryRoleAppointments(
	personDocumentId: string,
): Promise<Array<CountryRoleAppointment>> {
	const countryRoles = Object.keys(countryRoleRuleByRoleType) as Array<CountryRoleType>;

	const rows = await db
		.select({
			id: schema.personsToOrganisationalUnits.id,
			roleType: schema.personRoleTypes.type,
			countryDocumentId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			countryName: schema.organisationalUnits.name,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
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
		.where(
			and(
				eq(schema.personsToOrganisationalUnits.personDocumentId, personDocumentId),
				inArray(schema.personRoleTypes.type, countryRoles),
			),
		);

	return rows
		.filter((row) => row.duration.end == null)
		.map((row) => {
			return {
				id: row.id,
				roleType: row.roleType as CountryRoleType,
				countryDocumentId: row.countryDocumentId,
				countryName: row.countryName,
				start: row.duration.start.toISOString(),
			};
		});
}

/** The counterpart row an end-appointment run will close, resolved from the paired rule. */
export interface CountryRoleCounterpartToEnd {
	rule: string;
	relationId: string;
	roleType: PersonRoleType;
	unitName: string;
	start: Date;
}

/**
 * The still-open governance-body relation that pairs with `roleType`, if there is one.
 *
 * Any accepted role counts, so a coordinator who chairs the committee has their chairship closed
 * rather than being left with an open one — the rule treats chairing as being on the committee, and
 * so must its inverse.
 */
export async function resolveOpenCounterpartToEnd(
	client: Database | Transaction,
	roleType: CountryRoleType,
	existing: Array<ExistingPersonRelation>,
): Promise<CountryRoleCounterpartToEnd | null> {
	const ruleName = countryRoleRuleByRoleType[roleType];
	const rule = pairedRelationRules.find((entry) => entry.name === ruleName);

	if (rule?.b.unitSlug == null) {
		return null;
	}

	const unit = await getUnitReferenceBySlug(client, rule.b.unitSlug);
	if (unit == null) {
		return null;
	}

	const open = existing.find(
		(relation) =>
			relation.end == null &&
			(rule.b.roleTypes as ReadonlyArray<string>).includes(relation.roleType) &&
			relation.organisationalUnitDocumentId === unit.documentId,
	);

	if (open == null) {
		return null;
	}

	return {
		rule: rule.name,
		relationId: open.id,
		roleType: open.roleType,
		unitName: unit.name,
		start: open.start,
	};
}

export interface EndCountryRolePreflightInput {
	/** `personsToOrganisationalUnits.id` of the country role being ended. */
	appointmentId: string;
	end: string;
}

export interface EndCountryRolePreflight extends WizardPreflight {
	/** The counterpart row the submit will close, or null when there is nothing to close. */
	counterpartRelationId: string | null;
}

/**
 * The inverse of appointing: ending a country role must close the governance-body seat that came
 * with it, on the same date. Leaving the seat open is exactly the state `pairedRelationRules`
 * reports as a duration mismatch, and it is the easier half to forget — the appointment is the one
 * people remember to end.
 */
export async function getEndCountryRolePreflight(
	input: EndCountryRolePreflightInput,
): Promise<EndCountryRolePreflight> {
	const items: Array<WizardPlanItem> = [];
	const warnings: Array<WizardWarning> = [];

	const appointment = await db.query.personsToOrganisationalUnits.findFirst({
		where: { id: input.appointmentId },
		columns: {
			id: true,
			duration: true,
			personDocumentId: true,
			organisationalUnitDocumentId: true,
		},
		with: { roleType: { columns: { type: true } } },
	});

	if (appointment == null) {
		return { items, warnings, counterpartRelationId: null };
	}

	const roleType = appointment.roleType.type as CountryRoleType;
	if (!(roleType in countryRoleRuleByRoleType)) {
		return { items, warnings, counterpartRelationId: null };
	}

	const [country, personName, existing] = await Promise.all([
		getUnitReferenceByDocumentId(db, appointment.organisationalUnitDocumentId),
		getPersonName(db, appointment.personDocumentId),
		getExistingPersonRelations(db, appointment.personDocumentId),
	]);

	const end = new Date(input.end);

	items.push({
		id: "appointment",
		status: "update",
		kind: "person_relation",
		personName,
		roleType,
		unitName: country?.name ?? appointment.organisationalUnitDocumentId,
		start: appointment.duration.start.toISOString(),
		end: input.end,
	});

	if (end <= appointment.duration.start) {
		warnings.push({
			id: "end-before-start",
			severity: "warning",
			code: "end_before_start",
			rule: countryRoleRuleByRoleType[roleType],
			values: { person: personName, relation: roleType.replaceAll("_", " ") },
		});
	}

	const counterpart = await resolveOpenCounterpartToEnd(db, roleType, existing);

	if (counterpart == null) {
		warnings.push({
			id: "counterpart-absent",
			severity: "info",
			code: "counterpart_absent",
			rule: countryRoleRuleByRoleType[roleType],
			values: { person: personName, relation: roleType.replaceAll("_", " ") },
		});

		return { items, warnings, counterpartRelationId: null };
	}

	// Ending a relation before it began would invert its period, which the database rejects outright.
	// Report it instead, and leave that row alone.
	if (counterpart.start >= end) {
		warnings.push({
			id: `counterpart-starts-after-end:${counterpart.rule}`,
			severity: "warning",
			code: "counterpart_starts_after_end",
			rule: counterpart.rule,
			values: {
				person: personName,
				relation: counterpart.roleType.replaceAll("_", " "),
				unit: counterpart.unitName,
			},
		});

		return { items, warnings, counterpartRelationId: null };
	}

	items.push({
		id: "counterpart",
		status: "update",
		kind: "person_relation",
		personName,
		roleType: counterpart.roleType,
		unitName: counterpart.unitName,
		start: counterpart.start.toISOString(),
		end: input.end,
	});

	return { items, warnings, counterpartRelationId: counterpart.relationId };
}

/** The person's current (draft-or-published) name, for stating the plan in words. */
async function getPersonName(
	client: Database | Transaction,
	personDocumentId: string,
): Promise<string> {
	const row = await client
		.select({ name: schema.persons.name })
		.from(schema.documentLifecycle)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(eq(schema.documentLifecycle.documentId, personDocumentId))
		.limit(1)
		.then((rows) => rows[0] ?? null);

	return row?.name ?? personDocumentId;
}

/** The period an existing counterpart row must be widened to so it covers the requested one. */
export function widenDuration(
	existing: { start: Date; end?: Date },
	requested: { start: Date; end: Date | null },
): { start: Date; end?: Date } {
	const start = existing.start < requested.start ? existing.start : requested.start;

	// An open-ended relation on either side stays open-ended: it already covers everything after its
	// start, so capping it would narrow rather than widen.
	if (existing.end == null || requested.end == null) {
		return { start };
	}

	return { start, end: existing.end > requested.end ? existing.end : requested.end };
}

export async function getCountryRolePreflight(
	input: CountryRolePreflightInput,
): Promise<WizardPreflight> {
	const items: Array<WizardPlanItem> = [];
	const warnings: Array<WizardWarning> = [];

	const country = await getUnitReferenceByDocumentId(db, input.countryDocumentId);
	if (country == null) {
		return { items, warnings };
	}

	const existing =
		input.personDocumentId == null
			? []
			: await getExistingPersonRelations(db, input.personDocumentId);

	const requested = toInterval(input.start, input.end);

	if (input.personDocumentId == null) {
		items.push({
			id: "person",
			status: "create",
			kind: "entity",
			entityType: "person",
			name: input.personName,
			lifecycle: input.lifecycle,
		});
	}

	const roleCandidates = existing.filter(
		(relation) =>
			relation.roleType === input.roleType &&
			relation.organisationalUnitDocumentId === input.countryDocumentId,
	);

	const isRoleCovered =
		roleCandidates.length > 0 &&
		subtractIntervals(
			[requested],
			toRawIntervals(
				roleCandidates.map((relation) => {
					return { start: relation.start, ...(relation.end != null ? { end: relation.end } : {}) };
				}),
			),
		).length === 0;

	items.push({
		id: "role",
		status: isRoleCovered ? "skip" : "create",
		kind: "person_relation",
		personName: input.personName,
		roleType: input.roleType,
		unitName: country.name,
		start: input.start,
		end: input.end,
	});

	const counterpart = await resolveCountryRoleCounterpart(
		db,
		input.roleType,
		existing,
		requested,
		input.counterpartRoleType,
	);

	if (counterpart != null) {
		const status = counterpart.isCovered
			? "skip"
			: counterpart.rowToWiden != null
				? "update"
				: "create";

		items.push({
			id: "counterpart",
			status,
			kind: "person_relation",
			personName: input.personName,
			// When the rule is already satisfied by another role, show the role actually on record
			// rather than the one that was asked for — nothing will be written for it.
			roleType:
				status === "skip"
					? (counterpart.coveringRoleType ?? counterpart.createAsRoleType)
					: counterpart.createAsRoleType,
			unitName: counterpart.unit.name,
			start: input.start,
			end: input.end,
		});

		if (status !== "create") {
			warnings.push({
				id: `paired:${counterpart.rule}`,
				severity: "info",
				code: status === "skip" ? "counterpart_present" : "counterpart_duration_mismatch",
				rule: counterpart.rule,
				values: {
					person: input.personName,
					relation: (status === "skip"
						? (counterpart.coveringRoleType ?? counterpart.createAsRoleType)
						: counterpart.createAsRoleType
					).replaceAll("_", " "),
					unit: counterpart.unit.name,
				},
			});
		}
	}

	return { items, warnings };
}

/**
 * A relation the retire wizard offers to close, identified by the row it will update.
 *
 * `inactiveUnitRelationRules` says which relations must not stay open once a unit is inactive — the
 * unit's own membership, and the person relations that only make sense while it exists. Retiring a
 * unit therefore means ending several rows on one date, which is exactly what the guided form
 * does.
 */
export interface RetirableRelation {
	/** `unit_relation:<id>` or `person_relation:<id>` — the wizard's selection key. */
	key: string;
	rowId: string;
	kind: "person_relation" | "unit_relation";
	/** The rule that says this relation must be closed. */
	rule: string;
	/** Status or role type of the relation, e.g. `is_part_of` or `is_chair_of`. */
	relationType: string;
	/** The other side of the relation: the related unit, or the person holding the role. */
	counterpartName: string;
	start: string;
}

export interface RetireUnitPreflight extends WizardPreflight {
	unit: UnitReference | null;
	relations: Array<RetirableRelation>;
}

/**
 * Everything still open on a unit that `inactiveUnitRelationRules` says must be closed once it is
 * retired. Only rows without an end date are offered: an already-ended relation is not a finding.
 */
export async function getRetireUnitPreflight(input: {
	unitDocumentId: string;
	end: string;
}): Promise<RetireUnitPreflight> {
	const items: Array<WizardPlanItem> = [];
	const warnings: Array<WizardWarning> = [];
	const relations: Array<RetirableRelation> = [];

	const unit = await getUnitReferenceByDocumentId(db, input.unitDocumentId);
	if (unit == null) {
		return { items, warnings, relations, unit: null };
	}

	const rules = inactiveUnitRelationRules.filter(
		(rule) => rule.inactiveWhen.unitType === unit.type,
	);

	if (rules.length === 0) {
		return { items, warnings, relations, unit };
	}

	const [unitRelations, personRelations] = await Promise.all([
		getExistingUnitRelations(db, unit.documentId),
		getOpenPersonRelationsForUnit(db, unit.documentId),
	]);

	for (const rule of rules) {
		for (const relation of unitRelations) {
			if (
				relation.end != null ||
				!(rule.inactiveWhen.statuses as ReadonlyArray<string>).includes(relation.statusType)
			) {
				continue;
			}

			const counterpart = await getUnitReferenceByDocumentId(db, relation.relatedUnitDocumentId);

			relations.push({
				key: `unit_relation:${relation.id}`,
				rowId: relation.id,
				kind: "unit_relation",
				rule: rule.name,
				relationType: relation.statusType,
				counterpartName: counterpart?.name ?? relation.relatedUnitDocumentId,
				start: relation.start.toISOString(),
			});

			items.push({
				id: `unit_relation:${relation.id}`,
				status: "update",
				kind: "unit_relation",
				unitName: unit.name,
				relationType: relation.statusType,
				relatedUnitName: counterpart?.name ?? relation.relatedUnitDocumentId,
				start: relation.start.toISOString(),
				end: input.end,
			});
		}

		for (const relation of personRelations) {
			if (!(rule.personRelations.roleTypes as ReadonlyArray<string>).includes(relation.roleType)) {
				continue;
			}

			relations.push({
				key: `person_relation:${relation.id}`,
				rowId: relation.id,
				kind: "person_relation",
				rule: rule.name,
				relationType: relation.roleType,
				counterpartName: relation.personName,
				start: relation.start.toISOString(),
			});

			items.push({
				id: `person_relation:${relation.id}`,
				status: "update",
				kind: "person_relation",
				personName: relation.personName,
				roleType: relation.roleType,
				unitName: unit.name,
				start: relation.start.toISOString(),
				end: input.end,
			});
		}
	}

	return { items, warnings, relations, unit };
}

interface OpenPersonRelationOnUnit {
	id: string;
	roleType: PersonRoleType;
	personName: string;
	start: Date;
}

/** Person relations to `unitDocumentId` which have no end date yet. */
async function getOpenPersonRelationsForUnit(
	client: Database | Transaction,
	unitDocumentId: string,
): Promise<Array<OpenPersonRelationOnUnit>> {
	const rows = await client
		.select({
			id: schema.personsToOrganisationalUnits.id,
			roleType: schema.personRoleTypes.type,
			personName: schema.persons.name,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.where(eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, unitDocumentId));

	return rows
		.filter((row) => row.duration.end == null)
		.map((row) => {
			return {
				id: row.id,
				roleType: row.roleType,
				personName: row.personName,
				start: row.duration.start,
			};
		});
}

/** The unit subtypes the retire wizard can act on, taken from the rules themselves. */
export const retirableUnitTypes = [
	...new Set(inactiveUnitRelationRules.map((rule) => rule.inactiveWhen.unitType)),
];

/**
 * Whether the requested relation is already fully covered by ones the unit holds.
 *
 * The submit actions re-run this inside their transaction: the preflight the admin reviewed is a
 * snapshot, and inserting a duplicate would hit the `*_unit_related_status_no_overlap` exclusion
 * constraint rather than doing the harmless thing.
 */
export function isRelationAlreadyRecorded(
	existing: Array<ExistingUnitRelation>,
	statusType: OrganisationalUnitStatusType,
	relatedUnitDocumentId: string,
	requested: Interval,
): boolean {
	return coversPeriod(
		existing.filter(
			(relation) =>
				relation.statusType === statusType &&
				relation.relatedUnitDocumentId === relatedUnitDocumentId,
		),
		requested,
	);
}

export { toInterval };
export type { ExistingUnitRelation, Interval };
