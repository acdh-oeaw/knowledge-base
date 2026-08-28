import type { JSONContent } from "@tiptap/core";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { type PgColumn, alias } from "drizzle-orm/pg-core";

import type { Database, Transaction } from "./index";
import * as schema from "./schema";

/**
 * Vocabulary shared by several of the rule sets below.
 *
 * An institution's relation to DARIAH-EU is recorded with one of four `institution -> eric`
 * statuses. The three below are degrees of full partnership; `is_cooperating_partner_of` is the
 * separate, lesser status which excludes them (see {@link mutuallyExclusiveUnitRelationRules}) and
 * which, unlike them, belongs to an institution in a _non_-member country (see
 * {@link countryMembershipRules}).
 */
const dariahPartnerInstitutionStatuses = [
	"is_partner_institution_of",
	"is_national_coordinating_institution_in",
	"is_national_representative_institution_in",
] as const satisfies ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;

const dariahPartnerInstitutionLabel =
	"Partner institution, national coordinating institution, or national representative institution of DARIAH-EU";

/** The `country -> eric` statuses which make a country part of DARIAH-EU. */
const dariahCountryMembershipStatuses = [
	"is_member_of",
	"is_observer_of",
] as const satisfies ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;

const dariahCountryMembershipLabel = "Member or observer of DARIAH-EU";

/**
 * Data-integrity checks for pairs of person-to-organisational-unit relations which must always be
 * entered together because they record the same fact from two angles — e.g. a person who is a
 * country's national representative (or deputy) must also be a member of the General Assembly
 * governance body for the same period.
 *
 * Neither relation is derived from the other: a user may enter either one first and forget its
 * counterpart, so every rule is checked **in both directions**. A finding is raised when one side
 * exists without the other, or when both exist but their durations do not line up.
 *
 * Shared by the `@dariah-eric/audit` cli scripts and the admin dashboard.
 */

/** One side of a paired-relation rule: a person-to-organisational-unit relation of a given shape. */
export interface RelationEndpoint {
	/** A relation with any of these role types satisfies this side. */
	roleTypes: ReadonlyArray<(typeof schema.personRoleTypesEnum)[number]>;
	/**
	 * Slug of the organisational-unit document the relation must point to. Omit to match a relation
	 * to any unit — the allowed-relations table already restricts the role types to the expected unit
	 * type (e.g. national representative → country), so the rule need not re-check it.
	 */
	unitSlug?: string;
	/** Human-readable name for this side, used in findings and the dashboard. */
	label: string;
}

export interface PairedRelationRule {
	name: string;
	/** The two relations which must co-exist. Order is irrelevant; both directions are checked. */
	a: RelationEndpoint;
	b: RelationEndpoint;
}

export const pairedRelationRules: Array<PairedRelationRule> = [
	{
		name: "national-representative-general-assembly",
		a: {
			roleTypes: ["national_representative", "national_representative_deputy"],
			label: "National representative (or deputy) of a country",
		},
		b: {
			roleTypes: ["is_member_of"],
			unitSlug: "general-assembly",
			label: "Member of the General Assembly",
		},
	},
	{
		name: "national-coordinator-ncc",
		a: {
			roleTypes: ["national_coordinator", "national_coordinator_deputy"],
			label: "National coordinator (or deputy) of a country",
		},
		b: {
			// Chairing or vice-chairing the committee is a role on it, so those count as being on the
			// committee alongside plain membership.
			roleTypes: ["is_member_of", "is_chair_of", "is_vice_chair_of"],
			unitSlug: "national-coordinator-committee",
			label: "Member, chair, or vice-chair of the National Coordinator Committee",
		},
	},
];

/**
 * Consecutive terms are often entered as separate rows on one side (e.g. representative then
 * deputy) but as a single continuous membership on the other, so intervals separated by at most
 * this gap are merged before comparison.
 */
const mergeGapMs = 24 * 60 * 60 * 1000;

/** Timestamps in epoch ms; an open-ended (ongoing) relation has `end: Infinity`. */
export interface Interval {
	start: number;
	end: number;
}

/** Sorts, then collapses intervals separated by at most `gapMs` into one. */
function mergeIntervals(intervals: Array<Interval>, gapMs: number): Array<Interval> {
	const sorted = intervals.toSorted((a, b) => a.start - b.start || a.end - b.end);

	const merged: Array<Interval> = [];

	for (const interval of sorted) {
		const last = merged.at(-1);

		if (last != null && interval.start <= last.end + gapMs) {
			last.end = Math.max(last.end, interval.end);
		} else {
			merged.push({ ...interval });
		}
	}

	return merged;
}

/** Timestamps for a set of durations exactly as recorded, i.e. without merging near-adjacent ones. */
export function toRawIntervals(durations: Array<{ start: Date; end?: Date }>): Array<Interval> {
	return durations.map((duration) => {
		return { start: duration.start.getTime(), end: duration.end?.getTime() ?? Infinity };
	});
}

function toIntervals(durations: Array<{ start: Date; end?: Date }>): Array<Interval> {
	return mergeIntervals(toRawIntervals(durations), mergeGapMs);
}

/**
 * The periods covered by both sets, merged. Intervals which merely touch at an endpoint do not
 * intersect: the result is a non-empty span, never a single instant.
 */
export function intersectIntervals(a: Array<Interval>, b: Array<Interval>): Array<Interval> {
	const intersections: Array<Interval> = [];

	for (const x of a) {
		for (const y of b) {
			const start = Math.max(x.start, y.start);
			const end = Math.min(x.end, y.end);

			if (start < end) {
				intersections.push({ start, end });
			}
		}
	}

	return mergeIntervals(intersections, 0);
}

/** The parts of `a` which no interval in `b` covers, merged; empty when `b` covers all of `a`. */
export function subtractIntervals(a: Array<Interval>, b: Array<Interval>): Array<Interval> {
	let remaining = mergeIntervals(a, 0);

	for (const cut of mergeIntervals(b, 0)) {
		const next: Array<Interval> = [];

		for (const interval of remaining) {
			// Disjoint (or merely touching): `cut` removes nothing from this interval.
			if (cut.end <= interval.start || cut.start >= interval.end) {
				next.push(interval);
				continue;
			}

			if (interval.start < cut.start) {
				next.push({ start: interval.start, end: cut.start });
			}
			if (cut.end < interval.end) {
				next.push({ start: cut.end, end: interval.end });
			}
		}

		remaining = next;
	}

	return remaining;
}

function areIntervalSetsEqual(a: Array<Interval>, b: Array<Interval>): boolean {
	return (
		a.length === b.length &&
		a.every(
			(interval, index) => interval.start === b[index]!.start && interval.end === b[index]!.end,
		)
	);
}

/** JSON-serializable so findings can cross a server/client boundary. `end: null` means ongoing. */
export interface RelationInterval {
	start: string;
	end: string | null;
}

export function toSerializableIntervals(intervals: Array<Interval>): Array<RelationInterval> {
	return intervals.map((interval) => {
		return {
			start: new Date(interval.start).toISOString(),
			end: interval.end === Infinity ? null : new Date(interval.end).toISOString(),
		};
	});
}

export type PairedRelationFindingKind = "missing_counterpart" | "duration_mismatch";

/** A duration on one side of a rule; an absent `end` means the relation is still ongoing. */
export interface RelationDuration {
	start: Date;
	end?: Date;
}

/**
 * Merges a side's durations into a normalised, display-ready set of intervals (see
 * {@link mergeGapMs}).
 */
export function mergeAdjacentDurations(
	durations: Array<RelationDuration>,
): Array<RelationInterval> {
	return toSerializableIntervals(toIntervals(durations));
}

/**
 * The outcome of comparing the two sides of a rule for one person; `null` means they are
 * consistent.
 */
export type PairClassification =
	| { kind: "missing_counterpart"; missingSide: "a" | "b" }
	| { kind: "duration_mismatch" }
	| null;

/**
 * Classifies the two sides of a paired-relation rule for a single person. Neither side is primary:
 * if either side has relations while the other has none, the missing side is reported — so the
 * check runs in both directions. If both sides exist but their merged intervals differ, it is a
 * duration mismatch. Both absent (or both present and equal) is consistent (`null`).
 */
export function classifyRelationPair(
	aDurations: Array<RelationDuration>,
	bDurations: Array<RelationDuration>,
): PairClassification {
	if (aDurations.length === 0 && bDurations.length === 0) {
		return null;
	}
	if (aDurations.length === 0) {
		return { kind: "missing_counterpart", missingSide: "a" };
	}
	if (bDurations.length === 0) {
		return { kind: "missing_counterpart", missingSide: "b" };
	}
	if (!areIntervalSetsEqual(toIntervals(aDurations), toIntervals(bDurations))) {
		return { kind: "duration_mismatch" };
	}
	return null;
}

/** The periods recorded for one side of a rule, labelled for display. */
export interface RelationSide {
	label: string;
	intervals: Array<RelationInterval>;
}

export interface PairedRelationFinding {
	rule: string;
	kind: PairedRelationFindingKind;
	personDocumentId: string;
	personSlug: string;
	personLabel: string;
	detail: string;
	/** Both sides of the rule, always in `[a, b]` order, so the dashboard can show them side by side. */
	sides: [RelationSide, RelationSide];
}

export interface PairedRelationCheckResult {
	findings: Array<PairedRelationFinding>;
	/** Rules which could not run, e.g. because an endpoint's unit document is missing. */
	errors: Array<string>;
}

/** Resolves an organisational-unit document id from its slug, throwing if no such document exists. */
async function resolveUnitIdBySlug(
	db: Database | Transaction,
	ruleName: string,
	slug: string,
): Promise<string> {
	const [unit] = await db
		.select({ id: schema.entities.id })
		.from(schema.entities)
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(
			schema.slugs,
			and(eq(schema.slugs.entityId, schema.entities.id), eq(schema.slugs.isPublished, true)),
		)
		.where(and(eq(schema.entityTypes.type, "organisational_units"), eq(schema.slugs.value, slug)));

	if (unit == null) {
		throw new Error(`Rule "${ruleName}": no organisational-unit document with slug "${slug}".`);
	}

	return unit.id;
}

/** As {@link resolveUnitIdBySlug}, but an omitted slug resolves to `undefined` (match any unit). */
async function resolveOptionalUnitIdBySlug(
	db: Database | Transaction,
	ruleName: string,
	slug: string | undefined,
): Promise<string | undefined> {
	if (slug == null) {
		return undefined;
	}

	return resolveUnitIdBySlug(db, ruleName, slug);
}

interface EndpointRelation {
	personDocumentId: string;
	personSlug: string;
	personLabel: string | null;
	duration: { start: Date; end?: Date };
}

async function getEndpointRelations(
	db: Database | Transaction,
	endpoint: RelationEndpoint,
	unitId: string | undefined,
): Promise<Array<EndpointRelation>> {
	const personEntities = schema.entities;

	return db
		.select({
			personDocumentId: schema.personsToOrganisationalUnits.personDocumentId,
			personSlug: schema.slugs.value,
			personLabel: personEntities.label,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.innerJoin(
			personEntities,
			eq(personEntities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			schema.slugs,
			and(eq(schema.slugs.entityId, personEntities.id), eq(schema.slugs.isPublished, true)),
		)
		.where(
			and(
				inArray(schema.personRoleTypes.type, [...endpoint.roleTypes]),
				unitId != null
					? eq(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, unitId)
					: undefined,
			),
		);
}

async function checkRule(
	db: Database | Transaction,
	rule: PairedRelationRule,
): Promise<Array<PairedRelationFinding>> {
	const [aUnitId, bUnitId] = await Promise.all([
		resolveOptionalUnitIdBySlug(db, rule.name, rule.a.unitSlug),
		resolveOptionalUnitIdBySlug(db, rule.name, rule.b.unitSlug),
	]);

	const [aRows, bRows] = await Promise.all([
		getEndpointRelations(db, rule.a, aUnitId),
		getEndpointRelations(db, rule.b, bUnitId),
	]);

	interface PersonRelations {
		personSlug: string;
		personLabel: string;
		a: Array<EndpointRelation>;
		b: Array<EndpointRelation>;
	}

	const byPerson = new Map<string, PersonRelations>();

	function getPerson(row: EndpointRelation): PersonRelations {
		let person = byPerson.get(row.personDocumentId);
		if (person == null) {
			person = {
				personSlug: row.personSlug,
				personLabel: row.personLabel ?? row.personDocumentId,
				a: [],
				b: [],
			};
			byPerson.set(row.personDocumentId, person);
		}
		return person;
	}

	for (const row of aRows) {
		getPerson(row).a.push(row);
	}
	for (const row of bRows) {
		getPerson(row).b.push(row);
	}

	const findings: Array<PairedRelationFinding> = [];

	for (const [personDocumentId, person] of byPerson) {
		const aDurations = person.a.map((row) => row.duration);
		const bDurations = person.b.map((row) => row.duration);

		const classification = classifyRelationPair(aDurations, bDurations);
		if (classification == null) {
			continue;
		}

		const sides: [RelationSide, RelationSide] = [
			{ label: rule.a.label, intervals: mergeAdjacentDurations(aDurations) },
			{ label: rule.b.label, intervals: mergeAdjacentDurations(bDurations) },
		];

		const base = {
			rule: rule.name,
			personDocumentId,
			personSlug: person.personSlug,
			personLabel: person.personLabel,
			sides,
		};

		if (classification.kind === "missing_counterpart") {
			const present = classification.missingSide === "a" ? rule.b : rule.a;
			const missing = classification.missingSide === "a" ? rule.a : rule.b;
			findings.push({
				...base,
				kind: "missing_counterpart",
				detail: `Is "${present.label}" but is missing the matching "${missing.label}".`,
			});
		} else {
			findings.push({
				...base,
				kind: "duration_mismatch",
				detail: `Is both "${rule.a.label}" and "${rule.b.label}", but the periods do not match.`,
			});
		}
	}

	return findings;
}

export async function checkPairedRelations(
	db: Database | Transaction,
): Promise<PairedRelationCheckResult> {
	const findings: Array<PairedRelationFinding> = [];
	const errors: Array<string> = [];

	for (const rule of pairedRelationRules) {
		try {
			findings.push(...(await checkRule(db, rule)));
		} catch (error) {
			// oxlint-disable-next-line unicorn/no-instanceof-builtins
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	findings.sort(
		(a, b) =>
			a.rule.localeCompare(b.rule) ||
			a.kind.localeCompare(b.kind) ||
			a.personLabel.localeCompare(b.personLabel),
	);

	return { findings, errors };
}

/**
 * Data-integrity checks for organisational-unit relations where the presence of one relation on a
 * unit requires another relation on the **same** unit — e.g. every institution that is a partner
 * institution or cooperating partner of DARIAH-EU must also record which country it is located in.
 *
 * Unlike the paired-relation checks above, these are one-directional (a prerequisite, not a mirror
 * that must be entered from both sides) and compare presence only, not durations. A finding is
 * raised for each unit that has the trigger relation but not the required one.
 *
 * Shared by the `@dariah-eric/audit` cli scripts and the admin dashboard.
 */

/** A set of unit-to-unit relation statuses, optionally pinned to a specific related-unit document. */
export interface UnitRelationRequirementRule {
	name: string;
	/**
	 * The trigger: a unit which has any relation with one of these statuses to `relatedUnitSlug` must
	 * also satisfy `required`.
	 */
	trigger: {
		statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;
		/**
		 * Slug of the related-unit document the trigger relation must point to (e.g. the DARIAH-EU
		 * eric).
		 */
		relatedUnitSlug: string;
		/**
		 * Restrict the check to trigger units of this subtype. Needed because the same relation status
		 * may exist on units the requirement cannot apply to — e.g. a _country_ can also be a partner
		 * of DARIAH-EU, but only _institutions_ are ever `is_located_in` a country, so a country would
		 * otherwise be flagged as a false positive.
		 */
		unitType?: (typeof schema.organisationalUnitTypesEnum)[number];
		/** Human-readable name for the trigger, used in findings and the dashboard. */
		label: string;
	};
	/**
	 * The relation the same unit must also have. The type of the related unit need not be re-checked
	 * here — the allowed-relations table already restricts these statuses to the expected unit type
	 * (e.g. `is_located_in` only ever points institution → country).
	 */
	required: {
		statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;
		/** Human-readable name for the required relation, used in findings and the dashboard. */
		label: string;
	};
}

export const unitRelationRequirementRules: Array<UnitRelationRequirementRule> = [
	{
		name: "dariah-partner-located-in-country",
		trigger: {
			// Every way an institution can relate to DARIAH-EU requires knowing its country — the
			// coordinating/representative statuses because they represent that country, the partner and
			// cooperating ones because {@link countryMembershipRules} constrains which country it may be.
			statuses: [...dariahPartnerInstitutionStatuses, "is_cooperating_partner_of"],
			relatedUnitSlug: "dariah-eu",
			unitType: "institution",
			label: `${dariahPartnerInstitutionLabel}, or cooperating partner of DARIAH-EU`,
		},
		required: {
			statuses: ["is_located_in"],
			label: "Located in a country",
		},
	},
];

export interface UnitRelationRequirementFinding {
	rule: string;
	unitDocumentId: string;
	unitSlug: string;
	unitLabel: string;
	/** Organisational-unit subtype (e.g. `institution`), used to build the dashboard detail link. */
	unitType: string;
	/** Label of the trigger relation the unit has. */
	triggerLabel: string;
	/** Label of the relation the unit is missing. */
	requiredLabel: string;
	detail: string;
}

export interface UnitRelationRequirementCheckResult {
	findings: Array<UnitRelationRequirementFinding>;
	/** Rules which could not run, e.g. because the trigger's related-unit document is missing. */
	errors: Array<string>;
}

/** One unit-to-unit relation: which unit, which related unit, and for how long. */
export interface UnitRelationRow {
	unitDocumentId: string;
	relatedUnitDocumentId: string;
	duration: RelationDuration;
}

/**
 * Every unit-to-unit relation with one of `statuses`, optionally narrowed to those pointing to
 * `relatedUnitId` and/or held by one of `unitDocumentIds`.
 */
async function getUnitRelations(
	db: Database | Transaction,
	statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>,
	relatedUnitId?: string,
	unitDocumentIds?: Array<string>,
): Promise<Array<UnitRelationRow>> {
	if (unitDocumentIds?.length === 0) {
		return [];
	}

	return db
		.select({
			unitDocumentId: schema.organisationalUnitsRelations.unitDocumentId,
			relatedUnitDocumentId: schema.organisationalUnitsRelations.relatedUnitDocumentId,
			duration: schema.organisationalUnitsRelations.duration,
		})
		.from(schema.organisationalUnitsRelations)
		.innerJoin(
			schema.organisationalUnitStatus,
			eq(schema.organisationalUnitStatus.id, schema.organisationalUnitsRelations.status),
		)
		.where(
			and(
				inArray(schema.organisationalUnitStatus.status, [...statuses]),
				relatedUnitId != null
					? eq(schema.organisationalUnitsRelations.relatedUnitDocumentId, relatedUnitId)
					: undefined,
				unitDocumentIds != null
					? inArray(schema.organisationalUnitsRelations.unitDocumentId, unitDocumentIds)
					: undefined,
			),
		);
}

/**
 * Document ids of every unit with any relation of one of `statuses` (optionally to
 * `relatedUnitId`).
 */
async function getUnitDocumentIdsWithStatus(
	db: Database | Transaction,
	statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>,
	relatedUnitId?: string,
): Promise<Set<string>> {
	const rows = await getUnitRelations(db, statuses, relatedUnitId);

	return new Set(rows.map((row) => row.unitDocumentId));
}

export interface UnitDetail {
	slug: string;
	label: string | null;
	type: string;
}

/** Resolves display fields (slug, label, subtype) for a set of unit document ids. */
async function getUnitDetails(
	db: Database | Transaction,
	unitDocumentIds: Array<string>,
): Promise<Map<string, UnitDetail>> {
	if (unitDocumentIds.length === 0) {
		return new Map();
	}

	// A document's slug can now differ between its draft and published versions, so resolve each
	// document to a single canonical version — published when one exists, else the draft.
	const rows = await db
		.select({
			unitDocumentId: schema.entities.id,
			slug: schema.slugs.value,
			label: schema.entities.label,
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
		.where(inArray(schema.entities.id, unitDocumentIds));

	return new Map(
		rows.map((row) => [row.unitDocumentId, { slug: row.slug, label: row.label, type: row.type }]),
	);
}

async function checkUnitRelationRequirementRule(
	db: Database | Transaction,
	rule: UnitRelationRequirementRule,
): Promise<Array<UnitRelationRequirementFinding>> {
	const relatedUnitId = await resolveUnitIdBySlug(db, rule.name, rule.trigger.relatedUnitSlug);

	const [triggerUnitIds, requiredUnitIds] = await Promise.all([
		getUnitDocumentIdsWithStatus(db, rule.trigger.statuses, relatedUnitId),
		getUnitDocumentIdsWithStatus(db, rule.required.statuses),
	]);

	const missingUnitIds = [...triggerUnitIds].filter((id) => !requiredUnitIds.has(id));
	const details = await getUnitDetails(db, missingUnitIds);

	return missingUnitIds.flatMap((unitDocumentId) => {
		const detail = details.get(unitDocumentId);

		// Drop trigger units of the wrong subtype (see `trigger.unitType`), and any unit whose subtype
		// could not be resolved when the rule is type-restricted.
		if (rule.trigger.unitType != null && detail?.type !== rule.trigger.unitType) {
			return [];
		}

		return [
			{
				rule: rule.name,
				unitDocumentId,
				unitSlug: detail?.slug ?? unitDocumentId,
				unitLabel: detail?.label ?? unitDocumentId,
				unitType: detail?.type ?? "institution",
				triggerLabel: rule.trigger.label,
				requiredLabel: rule.required.label,
				detail: `Is "${rule.trigger.label}" but is missing the required "${rule.required.label}".`,
			},
		];
	});
}

export async function checkUnitRelationRequirements(
	db: Database | Transaction,
): Promise<UnitRelationRequirementCheckResult> {
	const findings: Array<UnitRelationRequirementFinding> = [];
	const errors: Array<string> = [];

	for (const rule of unitRelationRequirementRules) {
		try {
			findings.push(...(await checkUnitRelationRequirementRule(db, rule)));
		} catch (error) {
			// oxlint-disable-next-line unicorn/no-instanceof-builtins
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	findings.sort((a, b) => a.rule.localeCompare(b.rule) || a.unitLabel.localeCompare(b.unitLabel));

	return { findings, errors };
}

/**
 * Data-integrity checks for organisational units that are no longer active but still have person
 * relations extending past that point — e.g. a working group whose `is_part_of` relation to an ERIC
 * has ended, yet whose chair/vice-chair/member/contact relations are still recorded as ongoing or
 * carry an end date later than the working group's.
 *
 * A unit is considered inactive when it has at least one relation of the configured trigger status
 * and _none_ of those relations is still ongoing (all have an end date). For every such unit, each
 * person relation of the configured role types that is still ongoing, or that ends after the unit's
 * inactivity date, is reported so its end date can be corrected.
 *
 * Shared by the `@dariah-eric/audit` cli scripts and the admin dashboard.
 */

/** Configures which units count as inactive and which of their person relations must then be closed. */
export interface InactiveUnitRelationRule {
	name: string;
	/**
	 * Marks a unit inactive: it has a unit-to-unit relation of one of these statuses, and every such
	 * relation has ended.
	 */
	inactiveWhen: {
		statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;
		/**
		 * Restrict the check to units of this subtype (e.g. `working_group`). The same status may exist
		 * on units the rule cannot apply to, so the subtype must be pinned.
		 */
		unitType: (typeof schema.organisationalUnitTypesEnum)[number];
		/** Human-readable name for the trigger, used in findings and the dashboard. */
		label: string;
	};
	/** Person relations of these role types to an inactive unit must also have an end date. */
	personRelations: {
		roleTypes: ReadonlyArray<(typeof schema.personRoleTypesEnum)[number]>;
		/** Human-readable name for the person relations, used in findings and the dashboard. */
		label: string;
	};
}

export const inactiveUnitRelationRules: Array<InactiveUnitRelationRule> = [
	{
		name: "inactive-working-group-relations-closed",
		inactiveWhen: {
			statuses: ["is_part_of"],
			unitType: "working_group",
			label: "Working group that is no longer part of an ERIC",
		},
		personRelations: {
			roleTypes: ["is_chair_of", "is_vice_chair_of", "is_member_of", "is_contact_for"],
			label: "Chair, vice-chair, member, or contact",
		},
	},
	{
		name: "inactive-country-relations-closed",
		inactiveWhen: {
			statuses: ["is_member_of"],
			unitType: "country",
			label: "Country that is no longer a member",
		},
		personRelations: {
			roleTypes: [
				"national_coordinator",
				"national_coordinator_deputy",
				"national_representative",
				"national_representative_deputy",
				"is_contact_for",
			],
			label: "National coordinator or representative (or deputy), or contact",
		},
	},
];

export interface InactiveUnitRelationFinding {
	rule: string;
	unitDocumentId: string;
	unitSlug: string;
	unitLabel: string;
	/** Organisational-unit subtype (e.g. `working_group`), used to build the dashboard detail link. */
	unitType: string;
	/** ISO date the unit became inactive (the latest end of its trigger relations). */
	unitEnd: string;
	personDocumentId: string;
	personSlug: string;
	personLabel: string;
	/** The person's role in the unit (e.g. `is_chair_of`). */
	roleType: string;
	/** ISO start date of the flagged person relation. */
	personRelationStart: string;
	/** ISO end date of the person relation, or `null` when it is still ongoing. */
	personRelationEnd: string | null;
	detail: string;
}

export interface InactiveUnitRelationCheckResult {
	findings: Array<InactiveUnitRelationFinding>;
	/** Rules which could not run. */
	errors: Array<string>;
}

/** Turns a role type into a short human-readable label, e.g. `is_vice_chair_of` -> "vice chair". */
function humanizeRoleType(roleType: string): string {
	return roleType
		.replace(/^is_/, "")
		.replace(/_(?:of|for)$/, "")
		.replaceAll("_", " ");
}

/** Turns a unit subtype into a human-readable label, e.g. `working_group` -> "working group". */
function humanizeUnitType(unitType: string): string {
	return unitType.replaceAll("_", " ");
}

/**
 * A unit is inactive when it has trigger relations and none of them is still ongoing (every one has
 * an end date). A unit with no trigger relations, or with any still-open one, is not inactive.
 */
export function isUnitInactive(durations: Array<RelationDuration>): boolean {
	return durations.length > 0 && durations.every((duration) => duration.end != null);
}

/**
 * A person relation to an inactive unit is inconsistent when it outlives the unit: it is still
 * ongoing (`relationEnd` is `null`), or its end date is later than the unit's inactivity date. A
 * relation that closes on or before `unitEnd` is consistent and not flagged.
 */
export function isRelationInconsistentWithInactiveUnit(
	relationEnd: Date | null,
	unitEnd: Date,
): boolean {
	return relationEnd == null || relationEnd.getTime() > unitEnd.getTime();
}

/** The latest end date among a set of durations, or `null` if all are ongoing. */
function latestEnd(durations: Array<RelationDuration>): Date | null {
	let latest: number | null = null;
	for (const { end } of durations) {
		if (end != null) {
			latest = latest == null ? end.getTime() : Math.max(latest, end.getTime());
		}
	}
	return latest == null ? null : new Date(latest);
}

/**
 * Groups the durations of every unit-to-unit relation of one of `statuses` (optionally only those
 * pointing to `relatedUnitId`) by unit document id.
 */
async function getUnitDurationsByStatus(
	db: Database | Transaction,
	statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>,
	relatedUnitId?: string,
): Promise<Map<string, Array<RelationDuration>>> {
	const rows = await getUnitRelations(db, statuses, relatedUnitId);

	const byUnit = new Map<string, Array<RelationDuration>>();
	for (const row of rows) {
		const durations = byUnit.get(row.unitDocumentId) ?? [];
		durations.push(row.duration);
		byUnit.set(row.unitDocumentId, durations);
	}
	return byUnit;
}

export interface PersonRelationToUnit {
	unitDocumentId: string;
	personDocumentId: string;
	personSlug: string;
	personLabel: string | null;
	roleType: string;
	duration: RelationDuration;
}

/** All person relations of one of `roleTypes` pointing to any of `unitDocumentIds`. */
async function getPersonRelationsToUnits(
	db: Database | Transaction,
	roleTypes: ReadonlyArray<(typeof schema.personRoleTypesEnum)[number]>,
	unitDocumentIds: Array<string>,
): Promise<Array<PersonRelationToUnit>> {
	if (unitDocumentIds.length === 0) {
		return [];
	}

	return db
		.select({
			unitDocumentId: schema.personsToOrganisationalUnits.organisationalUnitDocumentId,
			personDocumentId: schema.personsToOrganisationalUnits.personDocumentId,
			personSlug: schema.slugs.value,
			personLabel: schema.entities.label,
			roleType: schema.personRoleTypes.type,
			duration: schema.personsToOrganisationalUnits.duration,
		})
		.from(schema.personsToOrganisationalUnits)
		.innerJoin(
			schema.personRoleTypes,
			eq(schema.personRoleTypes.id, schema.personsToOrganisationalUnits.roleTypeId),
		)
		.innerJoin(
			schema.entities,
			eq(schema.entities.id, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			schema.documentLifecycle,
			eq(schema.documentLifecycle.documentId, schema.personsToOrganisationalUnits.personDocumentId),
		)
		.innerJoin(
			schema.persons,
			sql`${schema.persons.id} = COALESCE(${schema.documentLifecycle.publishedId}, ${schema.documentLifecycle.draftId})`,
		)
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.persons.id))
		.where(
			and(
				inArray(schema.personRoleTypes.type, [...roleTypes]),
				inArray(schema.personsToOrganisationalUnits.organisationalUnitDocumentId, unitDocumentIds),
			),
		);
}

/** Ids of the units of the rule's subtype that are inactive (see {@link isUnitInactive}). */
function inactiveUnitIdsForRule(
	rule: InactiveUnitRelationRule,
	durationsByUnit: Map<string, Array<RelationDuration>>,
	details: Map<string, UnitDetail>,
): Array<string> {
	return [...durationsByUnit.keys()].filter(
		(unitDocumentId) =>
			details.get(unitDocumentId)?.type === rule.inactiveWhen.unitType &&
			isUnitInactive(durationsByUnit.get(unitDocumentId)!),
	);
}

/**
 * Assembles a rule's findings from already-fetched data — pure, so the core logic is unit-testable
 * without a database. For every inactive unit of the rule's subtype, each person relation of the
 * rule's role types that outlives the unit (see {@link isRelationInconsistentWithInactiveUnit}) is
 * reported. Person relations pointing to units that are not inactive are ignored.
 */
export function buildInactiveUnitRelationFindings(
	rule: InactiveUnitRelationRule,
	durationsByUnit: Map<string, Array<RelationDuration>>,
	details: Map<string, UnitDetail>,
	personRelations: Array<PersonRelationToUnit>,
): Array<InactiveUnitRelationFinding> {
	const inactiveUnitIds = new Set(inactiveUnitIdsForRule(rule, durationsByUnit, details));

	const findings: Array<InactiveUnitRelationFinding> = [];

	for (const relation of personRelations) {
		if (!inactiveUnitIds.has(relation.unitDocumentId)) {
			continue;
		}

		const detail = details.get(relation.unitDocumentId);
		// `latestEnd` is non-null: an inactive unit has at least one ended trigger relation.
		const unitEnd = latestEnd(durationsByUnit.get(relation.unitDocumentId)!)!;
		const relationEnd = relation.duration.end ?? null;

		if (!isRelationInconsistentWithInactiveUnit(relationEnd, unitEnd)) {
			continue;
		}

		const roleLabel = humanizeRoleType(relation.roleType);
		const unitTypeLabel = humanizeUnitType(detail?.type ?? rule.inactiveWhen.unitType);
		const unitLabel = detail?.label ?? relation.unitDocumentId;
		const detailMessage =
			relationEnd == null
				? `Is still an active "${roleLabel}", but the ${unitTypeLabel} "${unitLabel}" is no longer active.`
				: `Remains a "${roleLabel}" until ${relationEnd.toISOString().slice(0, 10)}, after the ${unitTypeLabel} "${unitLabel}" became inactive on ${unitEnd.toISOString().slice(0, 10)}.`;

		findings.push({
			rule: rule.name,
			unitDocumentId: relation.unitDocumentId,
			unitSlug: detail?.slug ?? relation.unitDocumentId,
			unitLabel: detail?.label ?? relation.unitDocumentId,
			unitType: detail?.type ?? rule.inactiveWhen.unitType,
			unitEnd: unitEnd.toISOString(),
			personDocumentId: relation.personDocumentId,
			personSlug: relation.personSlug,
			personLabel: relation.personLabel ?? relation.personDocumentId,
			roleType: relation.roleType,
			personRelationStart: relation.duration.start.toISOString(),
			personRelationEnd: relationEnd == null ? null : relationEnd.toISOString(),
			detail: detailMessage,
		});
	}

	return findings;
}

async function checkInactiveUnitRelationRule(
	db: Database | Transaction,
	rule: InactiveUnitRelationRule,
): Promise<Array<InactiveUnitRelationFinding>> {
	const durationsByUnit = await getUnitDurationsByStatus(db, rule.inactiveWhen.statuses);
	const details = await getUnitDetails(db, [...durationsByUnit.keys()]);

	const inactiveUnitIds = inactiveUnitIdsForRule(rule, durationsByUnit, details);

	const personRelations = await getPersonRelationsToUnits(
		db,
		rule.personRelations.roleTypes,
		inactiveUnitIds,
	);

	return buildInactiveUnitRelationFindings(rule, durationsByUnit, details, personRelations);
}

export async function checkInactiveUnitRelations(
	db: Database | Transaction,
): Promise<InactiveUnitRelationCheckResult> {
	const findings: Array<InactiveUnitRelationFinding> = [];
	const errors: Array<string> = [];

	for (const rule of inactiveUnitRelationRules) {
		try {
			findings.push(...(await checkInactiveUnitRelationRule(db, rule)));
		} catch (error) {
			// oxlint-disable-next-line unicorn/no-instanceof-builtins
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	findings.sort(
		(a, b) =>
			a.rule.localeCompare(b.rule) ||
			a.unitLabel.localeCompare(b.unitLabel) ||
			a.personLabel.localeCompare(b.personLabel),
	);

	return { findings, errors };
}

/**
 * Data-integrity checks for pairs of unit-to-unit relations which must never be recorded on the
 * same unit for the same period. A rule's `kind` says why, and therefore how to fix it:
 *
 * - `redundant` — `a` already implies `b`, so `b` carries no information of its own and should be
 *   removed: a national coordinating institution is by definition a partner institution, so the
 *   partner status is inferred from the coordinating relation rather than entered alongside it.
 * - `contradictory` — `a` and `b` are competing statuses which cannot both hold: an institution is
 *   either a cooperating partner of DARIAH-EU or a full partner/coordinating/representative
 *   institution, never both. Neither side is authoritative, so a human decides which one is wrong.
 *
 * Unlike the required-relation checks, these compare durations rather than mere presence, because
 * both relations may legitimately co-exist in the database over _separate_ periods — an institution
 * that was a partner institution until 2015 and became a national coordinating institution in 2020
 * is correct history, not a data error. Only where the two periods actually overlap is a finding
 * raised. Two periods that merely touch at an endpoint (one ends exactly when the other begins — a
 * clean handover) are not an overlap.
 *
 * Shared by the `@dariah-eric/audit` cli scripts and the admin dashboard.
 */

/** One side of a mutual-exclusion rule: a unit-to-unit relation of a given shape. */
export interface ExclusiveRelationEndpoint {
	/** A relation with any of these statuses satisfies this side. */
	statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;
	/**
	 * Slug of the related-unit document the relation must point to (e.g. the DARIAH-EU eric). Omit to
	 * match a relation to any related unit.
	 */
	relatedUnitSlug?: string;
	/** Human-readable name for this side, used in findings and the dashboard. */
	label: string;
}

/** Why two relations must not overlap, which decides how a finding is worded and resolved. */
export type MutuallyExclusiveFindingKind = "redundant" | "contradictory";

export interface MutuallyExclusiveUnitRelationRule {
	name: string;
	/**
	 * Restrict the check to units of this subtype. Needed because the same status may exist on units
	 * the rule cannot apply to (see `UnitRelationRequirementRule["trigger"]["unitType"]`).
	 */
	unitType?: (typeof schema.organisationalUnitTypesEnum)[number];
	kind: MutuallyExclusiveFindingKind;
	/** For `redundant` rules, the authoritative relation which implies `b`. */
	a: ExclusiveRelationEndpoint;
	/** For `redundant` rules, the inferable relation to remove. */
	b: ExclusiveRelationEndpoint;
}

export const mutuallyExclusiveUnitRelationRules: Array<MutuallyExclusiveUnitRelationRule> = [
	{
		name: "partner-institution-implied-by-national-coordinating-institution",
		unitType: "institution",
		kind: "redundant",
		a: {
			// Both statuses are institution -> eric relations, so this side is pinned to the same eric as
			// `b`: coordinating *another* eric would not imply being a partner of DARIAH-EU.
			statuses: ["is_national_coordinating_institution_in"],
			relatedUnitSlug: "dariah-eu",
			label: "National coordinating institution in DARIAH-EU",
		},
		b: {
			statuses: ["is_partner_institution_of"],
			relatedUnitSlug: "dariah-eu",
			label: "Partner institution of DARIAH-EU",
		},
	},
	{
		name: "cooperating-partner-excludes-partner-institution",
		unitType: "institution",
		kind: "contradictory",
		a: {
			statuses: ["is_cooperating_partner_of"],
			relatedUnitSlug: "dariah-eu",
			label: "Cooperating partner of DARIAH-EU",
		},
		b: {
			statuses: dariahPartnerInstitutionStatuses,
			relatedUnitSlug: "dariah-eu",
			label: dariahPartnerInstitutionLabel,
		},
	},
];

export interface MutuallyExclusiveUnitRelationFinding {
	rule: string;
	kind: MutuallyExclusiveFindingKind;
	unitDocumentId: string;
	unitSlug: string;
	unitLabel: string;
	/** Organisational-unit subtype (e.g. `institution`), used to build the dashboard detail link. */
	unitType: string;
	/** Label of the rule's `a` side; for `redundant` rules, the authoritative relation. */
	aLabel: string;
	/** Label of the rule's `b` side; for `redundant` rules, the relation to remove. */
	bLabel: string;
	/** The periods during which both relations are recorded, i.e. what must be resolved. */
	overlaps: Array<RelationInterval>;
	detail: string;
}

export interface MutuallyExclusiveUnitRelationCheckResult {
	findings: Array<MutuallyExclusiveUnitRelationFinding>;
	/** Rules which could not run, e.g. because an endpoint's related-unit document is missing. */
	errors: Array<string>;
}

/**
 * The periods covered by both `a` and `b`, merged and display-ready; empty when the two never
 * coincide. Intervals which only touch at an endpoint do not overlap: an institution whose partner
 * relation ends exactly when its coordinating relation begins is a clean handover, so the
 * intersection must be a non-empty span, not a single instant.
 *
 * Durations are compared as recorded — unlike {@link classifyRelationPair}, near-adjacent periods
 * are deliberately not merged first, since bridging a gap between two relations could manufacture
 * an overlap that does not exist.
 */
export function findOverlappingPeriods(
	a: Array<RelationDuration>,
	b: Array<RelationDuration>,
): Array<RelationInterval> {
	return toSerializableIntervals(intersectIntervals(toRawIntervals(a), toRawIntervals(b)));
}

/**
 * Explains an overlap, and what to do about it, according to the rule's
 * {@link MutuallyExclusiveFindingKind}.
 */
function describeMutualExclusion(rule: MutuallyExclusiveUnitRelationRule): string {
	switch (rule.kind) {
		case "redundant": {
			return `Is "${rule.a.label}", which already implies "${rule.b.label}", but both relations are recorded for the same period. Remove the redundant "${rule.b.label}" relation.`;
		}
		case "contradictory": {
			return `Is recorded as both "${rule.a.label}" and "${rule.b.label}" for the same period, but these statuses are mutually exclusive. Remove whichever one is incorrect.`;
		}
	}
}

/**
 * Assembles a rule's findings from already-fetched data — pure, so the core logic is unit-testable
 * without a database. Reports each unit of the rule's subtype whose two sides overlap in time.
 */
export function buildMutuallyExclusiveUnitRelationFindings(
	rule: MutuallyExclusiveUnitRelationRule,
	aByUnit: Map<string, Array<RelationDuration>>,
	bByUnit: Map<string, Array<RelationDuration>>,
	details: Map<string, UnitDetail>,
): Array<MutuallyExclusiveUnitRelationFinding> {
	const findings: Array<MutuallyExclusiveUnitRelationFinding> = [];

	for (const [unitDocumentId, aDurations] of aByUnit) {
		const bDurations = bByUnit.get(unitDocumentId);
		if (bDurations == null) {
			continue;
		}

		const detail = details.get(unitDocumentId);

		// Drop units of the wrong subtype (see `unitType`), and any unit whose subtype could not be
		// resolved when the rule is type-restricted.
		if (rule.unitType != null && detail?.type !== rule.unitType) {
			continue;
		}

		const overlaps = findOverlappingPeriods(aDurations, bDurations);
		if (overlaps.length === 0) {
			continue;
		}

		findings.push({
			rule: rule.name,
			kind: rule.kind,
			unitDocumentId,
			unitSlug: detail?.slug ?? unitDocumentId,
			unitLabel: detail?.label ?? unitDocumentId,
			unitType: detail?.type ?? rule.unitType ?? "institution",
			aLabel: rule.a.label,
			bLabel: rule.b.label,
			overlaps,
			detail: describeMutualExclusion(rule),
		});
	}

	return findings;
}

async function checkMutuallyExclusiveUnitRelationRule(
	db: Database | Transaction,
	rule: MutuallyExclusiveUnitRelationRule,
): Promise<Array<MutuallyExclusiveUnitRelationFinding>> {
	const [aRelatedUnitId, bRelatedUnitId] = await Promise.all([
		resolveOptionalUnitIdBySlug(db, rule.name, rule.a.relatedUnitSlug),
		resolveOptionalUnitIdBySlug(db, rule.name, rule.b.relatedUnitSlug),
	]);

	const [aByUnit, bByUnit] = await Promise.all([
		getUnitDurationsByStatus(db, rule.a.statuses, aRelatedUnitId),
		getUnitDurationsByStatus(db, rule.b.statuses, bRelatedUnitId),
	]);

	// Only units carrying both sides can overlap, so details are fetched for those alone.
	const candidateUnitIds = [...aByUnit.keys()].filter((unitDocumentId) =>
		bByUnit.has(unitDocumentId),
	);
	const details = await getUnitDetails(db, candidateUnitIds);

	return buildMutuallyExclusiveUnitRelationFindings(rule, aByUnit, bByUnit, details);
}

export async function checkMutuallyExclusiveUnitRelations(
	db: Database | Transaction,
): Promise<MutuallyExclusiveUnitRelationCheckResult> {
	const findings: Array<MutuallyExclusiveUnitRelationFinding> = [];
	const errors: Array<string> = [];

	for (const rule of mutuallyExclusiveUnitRelationRules) {
		try {
			findings.push(...(await checkMutuallyExclusiveUnitRelationRule(db, rule)));
		} catch (error) {
			// oxlint-disable-next-line unicorn/no-instanceof-builtins
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	findings.sort((a, b) => a.rule.localeCompare(b.rule) || a.unitLabel.localeCompare(b.unitLabel));

	return { findings, errors };
}

/**
 * Data-integrity checks which follow a relation _chain_: how an institution relates to DARIAH-EU
 * constrains which country it may be located in.
 *
 * A full partner institution — including the national coordinating and representative institutions
 * — represents a country that is itself part of DARIAH-EU, so that country must be a member or
 * observer for as long as the institution holds the status. A cooperating partner is the mirror
 * image: it is how DARIAH-EU records an institution in a country which is _not_ a member or
 * observer, so there an overlapping membership is the error.
 *
 * The chain is `institution -(trigger)-> DARIAH-EU`, `institution -(is_located_in)-> country`,
 * `country -(is_member_of | is_observer_of)-> DARIAH-EU`. Institutions with no `is_located_in`
 * relation at all are skipped: {@link unitRelationRequirementRules} already reports those, and
 * flagging the same missing relation twice would only add noise.
 *
 * Periods are compared rather than mere presence. The country's status is judged only for the
 * period the institution _both_ holds the trigger relation and sits in that country, so an
 * institution that has moved between countries, or a country that joined or left DARIAH-EU, is
 * assessed against the relation that was actually in force at the time.
 *
 * Shared by the `@dariah-eric/audit` cli scripts and the admin dashboard.
 */

/** Whether the trigger relation demands the country's status, or rules it out. */
export type CountryMembershipRequirement = "required" | "forbidden";

export interface CountryMembershipRule {
	name: string;
	/** The institution's relation to the eric which brings the rule into force. */
	trigger: {
		statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;
		/** Slug of the eric the trigger relation must point to. */
		relatedUnitSlug: string;
		/**
		 * Restrict the check to units of this subtype, so a unit of another type carrying the same
		 * status is not judged by a rule that cannot apply to it.
		 */
		unitType: (typeof schema.organisationalUnitTypesEnum)[number];
		/** Human-readable name for the trigger, used in findings and the dashboard. */
		label: string;
	};
	/** The country's relation to the eric which the trigger either requires or forbids. */
	country: {
		statuses: ReadonlyArray<(typeof schema.organisationalUnitStatusEnum)[number]>;
		/** Slug of the eric the country's relation must point to. */
		relatedUnitSlug: string;
		requirement: CountryMembershipRequirement;
		/** Human-readable name for the country's relation, used in findings and the dashboard. */
		label: string;
	};
}

export const countryMembershipRules: Array<CountryMembershipRule> = [
	{
		name: "dariah-partner-institution-in-member-country",
		trigger: {
			statuses: dariahPartnerInstitutionStatuses,
			relatedUnitSlug: "dariah-eu",
			unitType: "institution",
			label: dariahPartnerInstitutionLabel,
		},
		country: {
			statuses: dariahCountryMembershipStatuses,
			relatedUnitSlug: "dariah-eu",
			requirement: "required",
			label: dariahCountryMembershipLabel,
		},
	},
	{
		name: "dariah-cooperating-partner-in-non-member-country",
		trigger: {
			statuses: ["is_cooperating_partner_of"],
			relatedUnitSlug: "dariah-eu",
			unitType: "institution",
			label: "Cooperating partner of DARIAH-EU",
		},
		country: {
			statuses: dariahCountryMembershipStatuses,
			relatedUnitSlug: "dariah-eu",
			requirement: "forbidden",
			label: dariahCountryMembershipLabel,
		},
	},
];

/**
 * `country_status_missing`: the country lacked the required status for part of the period.
 * `country_status_present`: the country held a status the institution's own status excludes.
 */
export type CountryMembershipFindingKind = "country_status_missing" | "country_status_present";

export interface CountryMembershipFinding {
	rule: string;
	kind: CountryMembershipFindingKind;
	unitDocumentId: string;
	unitSlug: string;
	unitLabel: string;
	/** Organisational-unit subtype (e.g. `institution`), used to build the dashboard detail link. */
	unitType: string;
	countryDocumentId: string;
	countrySlug: string;
	countryLabel: string;
	/** Label of the institution's relation to the eric. */
	triggerLabel: string;
	/** Label of the country's relation to the eric. */
	countryRelationLabel: string;
	/** The periods which violate the rule: uncovered when `required`, overlapping when `forbidden`. */
	periods: Array<RelationInterval>;
	detail: string;
}

export interface CountryMembershipCheckResult {
	findings: Array<CountryMembershipFinding>;
	/** Rules which could not run, e.g. because the eric document is missing. */
	errors: Array<string>;
}

/** Where an institution is located, and for how long. */
export interface UnitLocation {
	countryDocumentId: string;
	duration: RelationDuration;
}

/**
 * Assembles a rule's findings from already-fetched data — pure, so the core logic is unit-testable
 * without a database.
 */
export function buildCountryMembershipFindings(
	rule: CountryMembershipRule,
	triggerByUnit: Map<string, Array<RelationDuration>>,
	locationsByUnit: Map<string, Array<UnitLocation>>,
	countryStatusByCountry: Map<string, Array<RelationDuration>>,
	details: Map<string, UnitDetail>,
): Array<CountryMembershipFinding> {
	const findings: Array<CountryMembershipFinding> = [];

	for (const [unitDocumentId, triggerDurations] of triggerByUnit) {
		const unitDetail = details.get(unitDocumentId);

		// Drop units of the wrong subtype, and any whose subtype could not be resolved.
		if (unitDetail?.type !== rule.trigger.unitType) {
			continue;
		}

		const locations = locationsByUnit.get(unitDocumentId);

		// An institution with no country at all is `unitRelationRequirementRules`' finding to report.
		if (locations == null) {
			continue;
		}

		const triggerIntervals = toRawIntervals(triggerDurations);

		for (const location of locations) {
			// The institution only holds the status *and* sits in this country while both relations run,
			// so that intersection is the only period the country's status is judged on.
			const applicable = intersectIntervals(triggerIntervals, toRawIntervals([location.duration]));
			if (applicable.length === 0) {
				continue;
			}

			const countryStatus = toRawIntervals(
				countryStatusByCountry.get(location.countryDocumentId) ?? [],
			);

			const periods =
				rule.country.requirement === "required"
					? subtractIntervals(applicable, countryStatus)
					: intersectIntervals(applicable, countryStatus);

			if (periods.length === 0) {
				continue;
			}

			const countryDetail = details.get(location.countryDocumentId);
			const countryLabel = countryDetail?.label ?? location.countryDocumentId;

			findings.push({
				rule: rule.name,
				kind:
					rule.country.requirement === "required"
						? "country_status_missing"
						: "country_status_present",
				unitDocumentId,
				unitSlug: unitDetail.slug,
				unitLabel: unitDetail.label ?? unitDocumentId,
				unitType: unitDetail.type,
				countryDocumentId: location.countryDocumentId,
				countrySlug: countryDetail?.slug ?? location.countryDocumentId,
				countryLabel,
				triggerLabel: rule.trigger.label,
				countryRelationLabel: rule.country.label,
				periods: toSerializableIntervals(periods),
				detail:
					rule.country.requirement === "required"
						? `Is "${rule.trigger.label}" while located in "${countryLabel}", but "${countryLabel}" is not "${rule.country.label}" for that entire period.`
						: `Is "${rule.trigger.label}" while located in "${countryLabel}", but "${countryLabel}" is "${rule.country.label}" during that period, which this status excludes.`,
			});
		}
	}

	return findings;
}

async function checkCountryMembershipRule(
	db: Database | Transaction,
	rule: CountryMembershipRule,
): Promise<Array<CountryMembershipFinding>> {
	const [triggerEricId, countryEricId] = await Promise.all([
		resolveUnitIdBySlug(db, rule.name, rule.trigger.relatedUnitSlug),
		resolveUnitIdBySlug(db, rule.name, rule.country.relatedUnitSlug),
	]);

	const triggerByUnit = await getUnitDurationsByStatus(db, rule.trigger.statuses, triggerEricId);
	const unitDocumentIds = [...triggerByUnit.keys()];

	const [locationRows, countryStatusByCountry] = await Promise.all([
		getUnitRelations(db, ["is_located_in"], undefined, unitDocumentIds),
		getUnitDurationsByStatus(db, rule.country.statuses, countryEricId),
	]);

	const locationsByUnit = new Map<string, Array<UnitLocation>>();
	for (const row of locationRows) {
		const locations = locationsByUnit.get(row.unitDocumentId) ?? [];
		locations.push({ countryDocumentId: row.relatedUnitDocumentId, duration: row.duration });
		locationsByUnit.set(row.unitDocumentId, locations);
	}

	const details = await getUnitDetails(db, [
		...new Set([...unitDocumentIds, ...locationRows.map((row) => row.relatedUnitDocumentId)]),
	]);

	return buildCountryMembershipFindings(
		rule,
		triggerByUnit,
		locationsByUnit,
		countryStatusByCountry,
		details,
	);
}

export async function checkCountryMembership(
	db: Database | Transaction,
): Promise<CountryMembershipCheckResult> {
	const findings: Array<CountryMembershipFinding> = [];
	const errors: Array<string> = [];

	for (const rule of countryMembershipRules) {
		try {
			findings.push(...(await checkCountryMembershipRule(db, rule)));
		} catch (error) {
			// oxlint-disable-next-line unicorn/no-instanceof-builtins
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	findings.sort(
		(a, b) =>
			a.rule.localeCompare(b.rule) ||
			a.unitLabel.localeCompare(b.unitLabel) ||
			a.countryLabel.localeCompare(b.countryLabel),
	);

	return { findings, errors };
}

/**
 * Data-integrity check for the heading structure of rich-text content. Headings must form a proper
 * outline so the published pages are navigable and accessible: the editor offers `h2`–`h4` (the
 * page title is the sole `h1`), each rich-text field should open at `h2`, and levels must not be
 * skipped on the way down (an `h2` may be followed by an `h3`, but not straight by an `h4`).
 *
 * Unlike the {@link findRichTextNeedingCleanup} normalisation, these are **not** auto-fixable: the
 * correct level for a mis-nested heading depends on authorial intent, so the check only reports
 * them for an editor to correct. Shared by the `@dariah-eric/audit` cli scripts and the admin
 * dashboard.
 *
 * A "document" is scanned as a single outline: for a `rich_text` field, all of its content blocks
 * in `position` order (a heading may legitimately continue across an intervening image or embed
 * block); for an `accordion`, each item's body independently (each is its own nested document).
 */

/** The heading levels the editor allows in body content; `h1` is reserved for the page title. */
export const allowedHeadingLevels = [2, 3, 4] as const;

const topHeadingLevel = allowedHeadingLevels[0];
const deepestHeadingLevel = allowedHeadingLevels.at(-1)!;

/**
 * `disallowed_level`: a heading outside the allowed `h2`–`h4` range (e.g. an `h1` or `h5` that
 * slipped in via import or paste). `does_not_start_at_top`: the first heading of a document is
 * deeper than `h2`. `skipped_level`: a heading jumps more than one level below the previous one.
 */
export type HeadingHierarchyFindingKind =
	| "disallowed_level"
	| "does_not_start_at_top"
	| "skipped_level";

/** A single heading pulled from a document, in reading order. */
export interface HeadingOccurrence {
	level: number;
	text: string;
}

export interface HeadingHierarchyViolation {
	kind: HeadingHierarchyFindingKind;
	/** Index of the offending heading within the document's heading sequence. */
	index: number;
	level: number;
	/** The previous in-range heading level the violation is judged against, or `null` for the first. */
	previousLevel: number | null;
	text: string;
}

/** Collects heading nodes from a tiptap document in reading order, with their text. */
export function collectHeadings(doc: JSONContent | null | undefined): Array<HeadingOccurrence> {
	const headings: Array<HeadingOccurrence> = [];

	function collectText(node: JSONContent): string {
		if (typeof node.text === "string") {
			return node.text;
		}
		if (Array.isArray(node.content)) {
			return node.content.map((child) => collectText(child)).join("");
		}
		return "";
	}

	function walk(node: JSONContent | null | undefined): void {
		if (node == null) {
			return;
		}
		if (node.type === "heading") {
			const level = typeof node.attrs?.level === "number" ? node.attrs.level : topHeadingLevel;
			headings.push({ level, text: collectText(node).trim() });
		}
		if (Array.isArray(node.content)) {
			for (const child of node.content) {
				walk(child);
			}
		}
	}

	walk(doc);
	return headings;
}

/**
 * Pure hierarchy check over an ordered heading sequence, so the rules are unit-testable without a
 * database. A heading may always move _back up_ to a shallower level (a new section); only skipping
 * _down_ a level, opening below `h2`, or landing outside `h2`–`h4` is a violation.
 */
export function findHeadingHierarchyViolations(
	headings: Array<HeadingOccurrence>,
): Array<HeadingHierarchyViolation> {
	const violations: Array<HeadingHierarchyViolation> = [];

	// The last heading whose level was in range; the baseline for the skipped-level comparison.
	let previousValidLevel: number | null = null;

	headings.forEach((heading, index) => {
		const { level, text } = heading;

		if (level < topHeadingLevel || level > deepestHeadingLevel) {
			violations.push({
				kind: "disallowed_level",
				index,
				level,
				previousLevel: previousValidLevel,
				text,
			});
			// An out-of-range heading is not a valid baseline for the headings that follow it.
			return;
		}

		if (previousValidLevel == null) {
			if (level !== topHeadingLevel) {
				violations.push({ kind: "does_not_start_at_top", index, level, previousLevel: null, text });
			}
		} else if (level > previousValidLevel + 1) {
			violations.push({
				kind: "skipped_level",
				index,
				level,
				previousLevel: previousValidLevel,
				text,
			});
		}

		previousValidLevel = level;
	});

	return violations;
}

export interface HeadingHierarchyFinding {
	kind: HeadingHierarchyFindingKind;
	entityId: string;
	entityType: string;
	entityLabel: string | null;
	entitySlug: string;
	fieldName: string;
	/** Lifecycle status of the owning entity version (e.g. `draft`, `published`). */
	status: string;
	/**
	 * Where the offending outline lives: the field's own prose, or the body of a container block —
	 * which is validated on its own rather than as part of the page's outline.
	 */
	blockType: "rich_text" | "accordion" | "callout";
	/** Position of the offending content block within its field. */
	position: number;
	contentBlockId: string;
	level: number;
	previousLevel: number | null;
	/** Text of the offending heading, so an editor can find it. */
	headingText: string;
	detail: string;
}

export interface HeadingHierarchyCheckResult {
	findings: Array<HeadingHierarchyFinding>;
	errors: Array<string>;
}

const parentContentBlocks = alias(schema.contentBlocks, "parent_content_blocks");
const parentContentBlockTypes = alias(schema.contentBlockTypes, "parent_content_block_types");

/** One content block worth of headings, tagged with the block it came from. */
interface TaggedHeadings {
	headings: Array<HeadingOccurrence>;
	blockType: "rich_text" | "accordion" | "callout";
	contentBlockId: string;
	position: number;
}

function describeHeadingViolation(violation: HeadingHierarchyViolation): string {
	const heading = `"h${String(violation.level)}"`;
	switch (violation.kind) {
		case "disallowed_level": {
			return `Heading level ${heading} is outside the allowed h2–h4 range and should be corrected.`;
		}
		case "does_not_start_at_top": {
			return `The first heading is ${heading}; a field should open at "h2".`;
		}
		case "skipped_level": {
			return `Heading level ${heading} follows "h${String(violation.previousLevel)}", skipping a level.`;
		}
	}
}

/** Metadata every finding for one scanned document shares. */
type HeadingHierarchyMeta = Pick<
	HeadingHierarchyFinding,
	"entityId" | "entityLabel" | "entitySlug" | "entityType" | "fieldName" | "status"
>;

export async function checkHeadingHierarchy(
	db: Database | Transaction,
): Promise<HeadingHierarchyCheckResult> {
	const findings: Array<HeadingHierarchyFinding> = [];
	const errors: Array<string> = [];

	function addFindings(meta: HeadingHierarchyMeta, tagged: Array<TaggedHeadings>): void {
		const ordered = tagged.toSorted((a, b) => a.position - b.position);
		// Flatten the field's headings into one sequence, remembering the block each came from.
		const flat = ordered.flatMap((entry) =>
			entry.headings.map((heading) => {
				return {
					heading,
					blockType: entry.blockType,
					contentBlockId: entry.contentBlockId,
					position: entry.position,
				};
			}),
		);

		const violations = findHeadingHierarchyViolations(flat.map((entry) => entry.heading));
		for (const violation of violations) {
			const origin = flat[violation.index]!;
			findings.push({
				kind: violation.kind,
				...meta,
				blockType: origin.blockType,
				position: origin.position,
				contentBlockId: origin.contentBlockId,
				level: violation.level,
				previousLevel: violation.previousLevel,
				headingText: violation.text,
				detail: describeHeadingViolation(violation),
			});
		}
	}

	try {
		const rows = await db
			.select({
				contentBlockId: schema.contentBlocks.id,
				position: schema.contentBlocks.position,
				parentBlockId: schema.contentBlocks.parentBlockId,
				parentBlockType: parentContentBlockTypes.type,
				richTextContent: schema.richTextContentBlocks.content,
				entityVersionId: schema.entityVersions.id,
				entityId: schema.entities.id,
				entityLabel: schema.entities.label,
				entitySlug: schema.slugs.value,
				entityType: schema.entityTypes.type,
				fieldName: schema.entityTypesFieldsNames.fieldName,
				status: schema.entityStatus.type,
			})
			.from(schema.contentBlocks)
			.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
			.innerJoin(
				schema.entityTypesFieldsNames,
				eq(schema.entityTypesFieldsNames.id, schema.fields.fieldNameId),
			)
			.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.fields.entityVersionId))
			.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
			.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
			.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
			.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
			.leftJoin(
				schema.richTextContentBlocks,
				eq(schema.richTextContentBlocks.id, schema.contentBlocks.id),
			)
			// The container a nested body belongs to, so a finding can name what it was found in.
			.leftJoin(parentContentBlocks, eq(parentContentBlocks.id, schema.contentBlocks.parentBlockId))
			.leftJoin(
				parentContentBlockTypes,
				eq(parentContentBlockTypes.id, parentContentBlocks.typeId),
			);

		// Per field (an entity version's rich-text field), the sequence of headings to validate as one
		// outline, plus the metadata every finding for that field shares.
		const richTextFields = new Map<
			string,
			{ meta: HeadingHierarchyMeta; sequences: Array<TaggedHeadings> }
		>();
		// A container's body is a self-contained document, validated on its own rather than as part of
		// the page outline — an accordion panel opens at "h2" of its own accord. Keyed by the container
		// so several blocks in one panel still read as one outline.
		const containerOutlines = new Map<
			string,
			{ meta: HeadingHierarchyMeta; sequences: Array<TaggedHeadings> }
		>();

		for (const row of rows) {
			const meta: HeadingHierarchyMeta = {
				entityId: row.entityId,
				entityLabel: row.entityLabel,
				entitySlug: row.entitySlug,
				entityType: row.entityType,
				fieldName: row.fieldName,
				status: row.status,
			};

			if (row.richTextContent == null) {
				continue;
			}

			const headings = collectHeadings(row.richTextContent);

			if (row.parentBlockId == null) {
				const key = `${row.entityVersionId}:${row.fieldName}`;
				const field = richTextFields.get(key) ?? { meta, sequences: [] };
				field.sequences.push({
					headings,
					blockType: "rich_text",
					contentBlockId: row.contentBlockId,
					position: row.position,
				});
				richTextFields.set(key, field);
				continue;
			}

			const outline = containerOutlines.get(row.parentBlockId) ?? { meta, sequences: [] };
			outline.sequences.push({
				headings,
				// A panel's body hangs off its `accordion_item`, so the accordion itself is one step
				// further up; either way the finding names the container an editor would recognise.
				blockType: row.parentBlockType === "callout" ? "callout" : "accordion",
				contentBlockId: row.contentBlockId,
				position: row.position,
			});
			containerOutlines.set(row.parentBlockId, outline);
		}

		for (const field of richTextFields.values()) {
			addFindings(field.meta, field.sequences);
		}
		for (const outline of containerOutlines.values()) {
			addFindings(outline.meta, outline.sequences);
		}
	} catch (error) {
		// oxlint-disable-next-line unicorn/no-instanceof-builtins
		errors.push(error instanceof Error ? error.message : String(error));
	}

	findings.sort(
		(a, b) =>
			a.entityType.localeCompare(b.entityType) ||
			(a.entityLabel ?? a.entitySlug).localeCompare(b.entityLabel ?? b.entitySlug) ||
			a.status.localeCompare(b.status) ||
			a.fieldName.localeCompare(b.fieldName) ||
			a.position - b.position ||
			a.level - b.level,
	);

	return { findings, errors };
}

/**
 * Heuristics which surface **candidate** duplicate documents — the same person, institution or
 * project entered twice, usually because a bulk import and a hand-authored entry met, or because
 * two editors created the same entry independently.
 *
 * Unlike every other rule set in this module these checks are _not_ about a violated invariant:
 * nothing here is provably wrong, and every finding needs a human to confirm it before the two
 * documents are merged. Findings are therefore scored rather than binary — each matching signal
 * contributes its weight, and a pair is only reported once the weights sum to
 * {@link defaultMinimumDuplicateScore}. Two weak signals on the same pair (a similar name _and_ a
 * shared acronym) outrank one weak signal alone.
 *
 * Shared by the `@dariah-eric/audit` cli scripts and the admin dashboard.
 */

/** The entity types with enough identifying fields to compare. */
export type DuplicateEntityType = "organisational_units" | "persons" | "projects";

/**
 * Why a pair looks like a duplicate.
 *
 * - `orcid` / `ror` — the same global identifier: two documents claiming one identifier is a
 *   contradiction, so these are the only near-conclusive signals here.
 * - `email` — the same mailbox. Strong for persons; weaker for units, where a shared institutional
 *   mailbox (`office@…`) is legitimately reused across departments.
 * - `link` — the same website or social-media url.
 * - `name` — identical names after normalisation (case, diacritics, punctuation and word order).
 * - `similar_name` — near-identical names (see {@link nameSimilarityThreshold}).
 * - `acronym` — the same acronym. Weak on its own: unrelated projects reuse short acronyms.
 */
export type DuplicateSignalKind =
	| "acronym"
	| "email"
	| "link"
	| "name"
	| "orcid"
	| "ror"
	| "similar_name";

const duplicateSignalWeights: Record<DuplicateSignalKind, number> = {
	orcid: 1,
	ror: 1,
	email: 0.8,
	name: 0.7,
	link: 0.6,
	similar_name: 0.5,
	acronym: 0.3,
};

/**
 * The score a pair must reach to be reported. Tuned so that any single signal except `acronym` and
 * `similar_name` reports on its own, while those two report as soon as anything corroborates them.
 */
export const defaultMinimumDuplicateScore = 0.5;

/** Two names count as `similar_name` at or above this Sørensen–Dice coefficient over bigrams. */
const nameSimilarityThreshold = 0.85;

/**
 * Tokens dropped from organisation and project names before comparison, so that "The University of
 * Vienna" and "University of Vienna" normalise alike. Deliberately **not** applied to person names,
 * where the same words are meaningful parts of a surname ("Jan de Vries").
 */
const nameStopwords = new Set(["and", "das", "der", "des", "die", "for", "of", "the", "und"]);

/**
 * A document reduced to the fields worth comparing. Built from the document's published version, or
 * its draft when it has never been published.
 */
export interface DuplicateEntityRecord {
	type: DuplicateEntityType;
	documentId: string;
	slug: string;
	name: string;
	/** Organisational-unit subtype (e.g. `institution`); absent for persons and projects. */
	subtype?: string;
	acronym?: string | null;
	email?: string | null;
	orcid?: string | null;
	ror?: string | null;
	/** Website and social-media urls recorded on the document. */
	links?: Array<string>;
}

export interface DuplicateSignal {
	kind: DuplicateSignalKind;
	/** The shared value, or the two names which matched, for display. */
	value: string;
}

/** One side of a candidate pair. */
export interface DuplicateEntityDetail {
	documentId: string;
	slug: string;
	name: string;
	subtype?: string;
}

export interface DuplicateCandidateFinding {
	type: DuplicateEntityType;
	a: DuplicateEntityDetail;
	b: DuplicateEntityDetail;
	/** Every signal which matched, strongest first. */
	signals: Array<DuplicateSignal>;
	/** Sum of the matching signals' weights; higher means more corroboration, not more certainty. */
	score: number;
	detail: string;
}

export interface DuplicateCandidateCheckResult {
	findings: Array<DuplicateCandidateFinding>;
	errors: Array<string>;
}

/** Lowercased and trimmed; `null` when there is nothing left to compare. */
export function normalizeEmail(value: string | null | undefined): string | null {
	const normalized = value?.trim().toLowerCase();

	return normalized == null || normalized === "" ? null : normalized;
}

/**
 * The bare identifier from an orcid or ror, whether it was entered as a url
 * (`https://ror.org/03prydq77`) or on its own (`03prydq77`), so the two forms compare equal.
 */
export function normalizeIdentifier(value: string | null | undefined): string | null {
	if (value == null) {
		return null;
	}

	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^(?:www\.)?(?:orcid\.org|ror\.org)\//, "")
		.replaceAll(/[^a-z0-9]/g, "");

	return normalized === "" ? null : normalized;
}

/**
 * Host and path only: protocol, `www.`, a trailing slash and any fragment are dropped, so
 * `https://www.example.org/` and `http://example.org` compare equal. The query string is kept —
 * some sites still identify a page by it.
 */
export function normalizeUrl(value: string | null | undefined): string | null {
	if (value == null) {
		return null;
	}

	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/^www\./, "")
		.replace(/#.*$/, "")
		.replace(/\/+$/, "");

	return normalized === "" ? null : normalized;
}

/**
 * Case, diacritics, punctuation and word order removed, so that "Müller, Anna" and "Anna Muller"
 * compare equal. Tokens are sorted rather than kept in order because both a person's `name` and
 * their `sortName` conventions, and an organisation's naming conventions, vary across importers.
 */
export function normalizeName(
	value: string | null | undefined,
	dropStopwords = false,
): string | null {
	if (value == null) {
		return null;
	}

	const tokens = value
		.normalize("NFKD")
		.replaceAll(/[\u0300-\u036F]/g, "")
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, " ")
		.trim()
		.split(" ")
		.filter((token) => token !== "" && !(dropStopwords && nameStopwords.has(token)));

	return tokens.length === 0 ? null : tokens.toSorted().join(" ");
}

/** Person names keep their stopwords; organisation and project names drop them. */
function normalizeRecordName(record: DuplicateEntityRecord): string | null {
	return normalizeName(record.name, record.type !== "persons");
}

/** The set of character bigrams in `value`, used for {@link diceCoefficient}. */
function toBigrams(value: string): Set<string> {
	const bigrams = new Set<string>();

	for (let index = 0; index < value.length - 1; index++) {
		bigrams.add(value.slice(index, index + 2));
	}

	return bigrams;
}

/**
 * Sørensen–Dice coefficient over character bigrams: `0` for no shared bigrams, `1` for identical
 * strings. Preferred over an edit distance because it needs no length-dependent threshold.
 */
export function diceCoefficient(a: string, b: string): number {
	if (a === b) {
		return 1;
	}

	const [first, second] = [toBigrams(a), toBigrams(b)];

	if (first.size === 0 || second.size === 0) {
		return 0;
	}

	let shared = 0;

	for (const bigram of first) {
		if (second.has(bigram)) {
			shared += 1;
		}
	}

	return (2 * shared) / (first.size + second.size);
}

/**
 * A name token shared by more than this many records (e.g. "institute") is not used to propose
 * candidate pairs: it would pair up every record with every other one for no gain, since a pair
 * which shares _only_ such a token scores below {@link nameSimilarityThreshold} anyway, and one
 * which shares the whole name is already caught by the exact `name` signal.
 */
const maximumNameBlockSize = 200;

/** Stable key for an unordered pair. */
function toPairKey(a: string, b: string): string {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function toDetail(record: DuplicateEntityRecord): DuplicateEntityDetail {
	return {
		documentId: record.documentId,
		slug: record.slug,
		name: record.name,
		...(record.subtype != null && { subtype: record.subtype }),
	};
}

/**
 * Every exact-match signal a record contributes, as `kind` → the value to group it by.
 *
 * Deduplicated, because a record may well carry the same value twice — a unit which records both a
 * website and a social-media entry pointing at the same url, say. Were the key kept twice the
 * record would land in its own bucket twice and be paired with itself.
 */
function getExactKeys(record: DuplicateEntityRecord): Array<[DuplicateSignalKind, string]> {
	const keys: Array<[DuplicateSignalKind, string]> = [];

	const orcid = normalizeIdentifier(record.orcid);
	if (orcid != null) {
		keys.push(["orcid", orcid]);
	}

	const ror = normalizeIdentifier(record.ror);
	if (ror != null) {
		keys.push(["ror", ror]);
	}

	const email = normalizeEmail(record.email);
	if (email != null) {
		keys.push(["email", email]);
	}

	const acronym = normalizeName(record.acronym);
	if (acronym != null) {
		keys.push(["acronym", acronym]);
	}

	const name = normalizeRecordName(record);
	if (name != null) {
		keys.push(["name", name]);
	}

	for (const link of record.links ?? []) {
		const url = normalizeUrl(link);

		if (url != null) {
			keys.push(["link", url]);
		}
	}

	const seen = new Set<string>();

	return keys.filter(([kind, value]) => {
		const key = `${kind}|${value}`;

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);

		return true;
	});
}

/**
 * Candidate pairs which share a normalised name token, so that the fuzzy name comparison runs on a
 * bounded number of pairs instead of every pair in the corpus (see {@link maximumNameBlockSize}).
 */
function getNameBlockCandidates(records: Array<DuplicateEntityRecord>): Set<string> {
	const recordsByToken = new Map<string, Array<string>>();

	for (const record of records) {
		const name = normalizeRecordName(record);

		if (name == null) {
			continue;
		}

		for (const token of new Set(name.split(" "))) {
			const bucket = recordsByToken.get(token) ?? [];
			bucket.push(record.documentId);
			recordsByToken.set(token, bucket);
		}
	}

	const pairs = new Set<string>();

	for (const bucket of recordsByToken.values()) {
		if (bucket.length > maximumNameBlockSize) {
			continue;
		}

		for (const [index, aId] of bucket.entries()) {
			for (const bId of bucket.slice(index + 1)) {
				pairs.add(toPairKey(aId, bId));
			}
		}
	}

	return pairs;
}

/**
 * Groups records into candidate duplicate pairs. Records of different {@link DuplicateEntityType}s
 * are never paired; organisational-unit subtypes are, since a duplicate is quite capable of having
 * been filed under the wrong subtype.
 *
 * Pure, and the entry point the tests exercise: {@link checkDuplicateEntities} only adds the queries
 * which build `records`.
 */
export function buildDuplicateCandidateFindings(
	records: Array<DuplicateEntityRecord>,
	minimumScore = defaultMinimumDuplicateScore,
): Array<DuplicateCandidateFinding> {
	const recordsById = new Map(records.map((record) => [record.documentId, record]));
	const signalsByPair = new Map<string, Array<DuplicateSignal>>();

	function addSignal(a: string, b: string, signal: DuplicateSignal): void {
		const key = toPairKey(a, b);
		const signals = signalsByPair.get(key) ?? [];
		signals.push(signal);
		signalsByPair.set(key, signals);
	}

	const recordsByExactKey = new Map<string, Array<string>>();

	for (const record of records) {
		for (const [kind, value] of getExactKeys(record)) {
			const key = `${record.type}|${kind}|${value}`;
			const bucket = recordsByExactKey.get(key) ?? [];
			bucket.push(record.documentId);
			recordsByExactKey.set(key, bucket);
		}
	}

	for (const [key, bucket] of recordsByExactKey) {
		if (bucket.length < 2) {
			continue;
		}

		const [, kind, value] = key.split("|") as [string, DuplicateSignalKind, string];

		for (const [index, aId] of bucket.entries()) {
			for (const bId of bucket.slice(index + 1)) {
				addSignal(aId, bId, { kind, value });
			}
		}
	}

	const recordsByType = new Map<DuplicateEntityType, Array<DuplicateEntityRecord>>();

	for (const record of records) {
		const bucket = recordsByType.get(record.type) ?? [];
		bucket.push(record);
		recordsByType.set(record.type, bucket);
	}

	for (const bucket of recordsByType.values()) {
		for (const pairKey of getNameBlockCandidates(bucket)) {
			const [aId, bId] = pairKey.split("|") as [string, string];
			const [a, b] = [recordsById.get(aId), recordsById.get(bId)];

			if (a == null || b == null) {
				continue;
			}

			const [aName, bName] = [normalizeRecordName(a), normalizeRecordName(b)];

			// Identical names are already reported by the exact `name` signal.
			if (aName == null || bName == null || aName === bName) {
				continue;
			}

			if (diceCoefficient(aName, bName) >= nameSimilarityThreshold) {
				addSignal(aId, bId, { kind: "similar_name", value: `"${a.name}" / "${b.name}"` });
			}
		}
	}

	const findings: Array<DuplicateCandidateFinding> = [];

	for (const [pairKey, signals] of signalsByPair) {
		const [aId, bId] = pairKey.split("|") as [string, string];
		const [a, b] = [recordsById.get(aId), recordsById.get(bId)];

		if (a == null || b == null) {
			continue;
		}

		const score = signals.reduce((total, signal) => total + duplicateSignalWeights[signal.kind], 0);

		if (score < minimumScore) {
			continue;
		}

		const sorted = signals.toSorted(
			(first, second) => duplicateSignalWeights[second.kind] - duplicateSignalWeights[first.kind],
		);

		findings.push({
			type: a.type,
			a: toDetail(a),
			b: toDetail(b),
			signals: sorted,
			score: Math.round(score * 100) / 100,
			detail: sorted.map((signal) => `${signal.kind}: ${signal.value}`).join("; "),
		});
	}

	return findings.toSorted(
		(first, second) =>
			second.score - first.score ||
			first.type.localeCompare(second.type) ||
			first.a.name.localeCompare(second.a.name) ||
			first.b.name.localeCompare(second.b.name),
	);
}

/**
 * The version of each document to compare: the published one, falling back to the draft for
 * documents which have never been published. Comparing every version instead would pair a
 * document's own draft with its published version.
 */
function toPreferredVersions<T extends { documentId: string; status: string }>(
	rows: Array<T>,
): Array<T> {
	const byDocument = new Map<string, T>();

	for (const row of rows) {
		const existing = byDocument.get(row.documentId);

		if (existing == null || row.status === "published") {
			byDocument.set(row.documentId, row);
		}
	}

	return [...byDocument.values()];
}

/** Website and social-media urls per organisational-unit or project _version_ id. */
async function getLinksByVersionId(
	db: Database | Transaction,
	table: typeof schema.organisationalUnitsToSocialMedia | typeof schema.projectsToSocialMedia,
	versionIdColumn: PgColumn,
): Promise<Map<string, Array<string>>> {
	const rows = await db
		.select({ versionId: versionIdColumn, url: schema.socialMedia.url })
		.from(table)
		.innerJoin(schema.socialMedia, eq(schema.socialMedia.id, table.socialMediaId));

	const linksByVersion = new Map<string, Array<string>>();

	for (const row of rows) {
		const links = linksByVersion.get(row.versionId) ?? [];
		links.push(row.url);
		linksByVersion.set(row.versionId, links);
	}

	return linksByVersion;
}

async function getPersonRecords(db: Database | Transaction): Promise<Array<DuplicateEntityRecord>> {
	const rows = await db
		.select({
			documentId: schema.entities.id,
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			name: schema.persons.name,
			email: schema.persons.email,
			orcid: schema.persons.orcid,
		})
		.from(schema.persons)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.persons.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id));

	return toPreferredVersions(rows).map((row) => {
		return {
			type: "persons",
			documentId: row.documentId,
			slug: row.slug,
			name: row.name,
			email: row.email,
			orcid: row.orcid,
		};
	});
}

async function getOrganisationalUnitRecords(
	db: Database | Transaction,
): Promise<Array<DuplicateEntityRecord>> {
	const rows = await db
		.select({
			documentId: schema.entities.id,
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			versionId: schema.organisationalUnits.id,
			name: schema.organisationalUnits.name,
			acronym: schema.organisationalUnits.acronym,
			email: schema.organisationalUnits.email,
			ror: schema.organisationalUnits.ror,
			subtype: schema.organisationalUnitTypes.type,
		})
		.from(schema.organisationalUnits)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.organisationalUnits.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.innerJoin(
			schema.organisationalUnitTypes,
			eq(schema.organisationalUnitTypes.id, schema.organisationalUnits.typeId),
		);

	const links = await getLinksByVersionId(
		db,
		schema.organisationalUnitsToSocialMedia,
		schema.organisationalUnitsToSocialMedia.organisationalUnitId,
	);

	return toPreferredVersions(rows).map((row) => {
		return {
			type: "organisational_units",
			documentId: row.documentId,
			slug: row.slug,
			name: row.name,
			subtype: row.subtype,
			acronym: row.acronym,
			email: row.email,
			ror: row.ror,
			links: links.get(row.versionId) ?? [],
		};
	});
}

async function getProjectRecords(
	db: Database | Transaction,
): Promise<Array<DuplicateEntityRecord>> {
	const rows = await db
		.select({
			documentId: schema.entities.id,
			slug: schema.slugs.value,
			status: schema.entityStatus.type,
			versionId: schema.projects.id,
			name: schema.projects.name,
			acronym: schema.projects.acronym,
		})
		.from(schema.projects)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.projects.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id));

	const links = await getLinksByVersionId(
		db,
		schema.projectsToSocialMedia,
		schema.projectsToSocialMedia.projectId,
	);

	return toPreferredVersions(rows).map((row) => {
		return {
			type: "projects",
			documentId: row.documentId,
			slug: row.slug,
			name: row.name,
			acronym: row.acronym,
			links: links.get(row.versionId) ?? [],
		};
	});
}

export async function checkDuplicateEntities(
	db: Database | Transaction,
	minimumScore = defaultMinimumDuplicateScore,
): Promise<DuplicateCandidateCheckResult> {
	const errors: Array<string> = [];

	try {
		const records = (
			await Promise.all([
				getPersonRecords(db),
				getOrganisationalUnitRecords(db),
				getProjectRecords(db),
			])
		).flat();

		return { findings: buildDuplicateCandidateFindings(records, minimumScore), errors };
	} catch (error) {
		// oxlint-disable-next-line unicorn/no-instanceof-builtins
		errors.push(error instanceof Error ? error.message : String(error));

		return { findings: [], errors };
	}
}

/**
 * Data-integrity check that stored web addresses are well-formed. Every URL-bearing column should
 * hold an absolute URL with an explicit scheme, and that scheme should be `https` rather than the
 * insecure `http` — a value with no scheme, a non-web scheme, or anything that does not parse is
 * flagged, and a plain `http` URL is flagged as insecure so it can be upgraded.
 *
 * Social-media entries are the one exception: a contact channel is sometimes an email address
 * rather than a web page, so for that column a bare email address (or a `mailto:` link) is accepted
 * in place of a URL.
 *
 * The check covers the dedicated URL columns only — the website of an event or opportunity, a
 * document/policy link, a license URL, a social-media URL, an embed block's URL, and a
 * working-group report event's URL. URLs embedded inside rich-text content (inline link marks, hero
 * call-to-action buttons) are deliberately out of scope: those legitimately include relative,
 * anchor, and `mailto:` links that this absolute-URL rule would mis-flag, and they need a separate
 * check.
 *
 * Reporting only — the correct address cannot be guessed automatically. Shared by the
 * `@dariah-eric/audit` cli scripts and the admin dashboard.
 */

/** Which column set a finding came from — groups findings and drives the dashboard's link. */
export type WebAddressSource =
	| "social_media"
	| "person_social_media_url"
	| "event_website"
	| "opportunity_website"
	| "document_policy_url"
	| "license_url"
	| "embed_block_url"
	| "working_group_report_event_url";

/**
 * `insecure_scheme`: a valid web URL that uses `http` instead of `https`. `invalid`: a value that
 * is not an absolute `http(s)` URL at all (no scheme, a non-web scheme, or unparseable) — and, for
 * columns that allow it, not an email address either.
 */
export type WebAddressFindingKind = "insecure_scheme" | "invalid";

/** Per-column policy: whether a bare email address is an acceptable value in place of a URL. */
export interface WebAddressPolicy {
	/** Accept a bare email address or a `mailto:` link instead of a web URL (social-media only). */
	allowEmail: boolean;
}

/** A bare email address with no scheme — the alternative some columns accept in place of a URL. */
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Pure validation of a single stored value against a column's policy, so the rules are
 * unit-testable without a database. Returns the kind of problem, or `null` when the value is
 * acceptable.
 */
export function validateWebAddress(
	value: string,
	policy: WebAddressPolicy,
): WebAddressFindingKind | null {
	const trimmed = value.trim();

	if (policy.allowEmail) {
		if (emailPattern.test(trimmed)) {
			return null;
		}
		const withoutMailto = trimmed.replace(/^mailto:/iu, "");
		if (withoutMailto !== trimmed) {
			return emailPattern.test(withoutMailto) ? null : "invalid";
		}
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		return "invalid";
	}

	// A URL like `https:///path` parses but has no host, which is never a usable web address.
	if (parsed.hostname === "") {
		return "invalid";
	}

	switch (parsed.protocol) {
		case "https:": {
			return null;
		}
		case "http:": {
			return "insecure_scheme";
		}
		default: {
			return "invalid";
		}
	}
}

function describeWebAddress(kind: WebAddressFindingKind, policy: WebAddressPolicy): string {
	switch (kind) {
		case "insecure_scheme": {
			return 'Uses an insecure "http" scheme; change it to "https".';
		}
		case "invalid": {
			return policy.allowEmail
				? "Is not a valid URL (with an https scheme) or email address."
				: "Is not a valid URL with an https scheme.";
		}
	}
}

export interface WebAddressFinding {
	kind: WebAddressFindingKind;
	source: WebAddressSource;
	/** Human-readable name of the column set, e.g. "Event website". */
	sourceLabel: string;
	/** Display name of the offending record (entity label, social-media name, etc.). */
	recordLabel: string;
	/** The stored value that failed validation. */
	value: string;
	detail: string;
	/** For entity-backed records: the entity type and slug, so the dashboard can link to its page. */
	entityType: string | null;
	entitySlug: string | null;
	/** Lifecycle status of the owning entity version (e.g. `draft`), when the record is versioned. */
	status: string | null;
	/** For social-media records: the row id, so the dashboard can link to its edit page. */
	socialMediaId: string | null;
	/**
	 * For working-group-report records: the owning report id, so the dashboard can link to the report
	 * step the value lives on. Reports are not entities, so they have no slug to link by.
	 */
	workingGroupReportId: string | null;
}

export interface WebAddressCheckResult {
	findings: Array<WebAddressFinding>;
	/** Sources which could not run. */
	errors: Array<string>;
}

/** Shared fields every {@link WebAddressFinding} needs beyond the value being validated. */
type WebAddressFindingMeta = Pick<
	WebAddressFinding,
	| "source"
	| "sourceLabel"
	| "recordLabel"
	| "entityType"
	| "entitySlug"
	| "socialMediaId"
	| "workingGroupReportId"
	| "status"
>;

/** Validates one stored value and, if it fails, turns it into a finding under the given policy. */
function toWebAddressFinding(
	value: string,
	policy: WebAddressPolicy,
	meta: WebAddressFindingMeta,
): WebAddressFinding | null {
	const kind = validateWebAddress(value, policy);
	if (kind == null) {
		return null;
	}
	return { ...meta, kind, value, detail: describeWebAddress(kind, policy) };
}

const httpsPolicy: WebAddressPolicy = { allowEmail: false };
const emailOrHttpsPolicy: WebAddressPolicy = { allowEmail: true };

/** Turns rows from an entity-subtype URL column into findings, tagging each with its owning entity. */
function buildEntityColumnFindings(
	rows: Array<{
		value: string | null;
		entityType: string;
		slug: string;
		label: string | null;
		status: string;
	}>,
	source: WebAddressSource,
	sourceLabel: string,
): Array<WebAddressFinding> {
	const findings: Array<WebAddressFinding> = [];
	for (const row of rows) {
		if (row.value == null) {
			continue;
		}
		const finding = toWebAddressFinding(row.value, httpsPolicy, {
			source,
			sourceLabel,
			recordLabel: row.label ?? row.slug,
			entityType: row.entityType,
			entitySlug: row.slug,
			status: row.status,
			socialMediaId: null,
			workingGroupReportId: null,
		});
		if (finding != null) {
			findings.push(finding);
		}
	}
	return findings;
}

async function checkEventWebsites(db: Database | Transaction): Promise<Array<WebAddressFinding>> {
	const rows = await db
		.select({
			value: schema.events.website,
			entityType: schema.entityTypes.type,
			slug: schema.slugs.value,
			label: schema.entities.label,
			status: schema.entityStatus.type,
		})
		.from(schema.events)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.events.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.where(isNotNull(schema.events.website));

	return buildEntityColumnFindings(rows, "event_website", "Event website");
}

async function checkOpportunityWebsites(
	db: Database | Transaction,
): Promise<Array<WebAddressFinding>> {
	const rows = await db
		.select({
			value: schema.opportunities.website,
			entityType: schema.entityTypes.type,
			slug: schema.slugs.value,
			label: schema.entities.label,
			status: schema.entityStatus.type,
		})
		.from(schema.opportunities)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.opportunities.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.where(isNotNull(schema.opportunities.website));

	return buildEntityColumnFindings(rows, "opportunity_website", "Opportunity website");
}

async function checkDocumentPolicyUrls(
	db: Database | Transaction,
): Promise<Array<WebAddressFinding>> {
	const rows = await db
		.select({
			value: schema.documentsPolicies.url,
			entityType: schema.entityTypes.type,
			slug: schema.slugs.value,
			label: schema.entities.label,
			status: schema.entityStatus.type,
		})
		.from(schema.documentsPolicies)
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.documentsPolicies.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id))
		.where(isNotNull(schema.documentsPolicies.url));

	return buildEntityColumnFindings(rows, "document_policy_url", "Document/policy link");
}

async function checkSocialMediaUrls(db: Database | Transaction): Promise<Array<WebAddressFinding>> {
	const rows = await db
		.select({
			id: schema.socialMedia.id,
			name: schema.socialMedia.name,
			url: schema.socialMedia.url,
		})
		.from(schema.socialMedia);

	const findings: Array<WebAddressFinding> = [];
	for (const row of rows) {
		const finding = toWebAddressFinding(row.url, emailOrHttpsPolicy, {
			source: "social_media",
			sourceLabel: "Social media",
			recordLabel: row.name,
			entityType: null,
			entitySlug: null,
			status: null,
			socialMediaId: row.id,
			workingGroupReportId: null,
		});
		if (finding != null) {
			findings.push(finding);
		}
	}
	return findings;
}

/**
 * A person's own social media. The write path validates these with `v.url()`, so what this catches
 * in practice is an `http` scheme — which passes validation — plus anything written outside the
 * form.
 */
async function checkPersonSocialMediaUrls(
	db: Database | Transaction,
): Promise<Array<WebAddressFinding>> {
	const rows = await db
		.select({
			value: schema.personSocialMedia.url,
			label: schema.personSocialMedia.label,
			entityType: schema.entityTypes.type,
			slug: schema.slugs.value,
			entityLabel: schema.entities.label,
			status: schema.entityStatus.type,
		})
		.from(schema.personSocialMedia)
		.innerJoin(schema.persons, eq(schema.persons.id, schema.personSocialMedia.personId))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.persons.id))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id));

	// The row's own label is only a display name for the entry, so the person is what identifies the
	// finding — with the entry's label appended when it has one.
	return buildEntityColumnFindings(
		rows.map((row) => {
			const person = row.entityLabel ?? row.slug;
			return {
				...row,
				label: row.label == null ? person : `${person} — ${row.label}`,
			};
		}),
		"person_social_media_url",
		"Person social media",
	);
}

async function checkLicenseUrls(db: Database | Transaction): Promise<Array<WebAddressFinding>> {
	const rows = await db
		.select({ name: schema.licenses.name, url: schema.licenses.url })
		.from(schema.licenses);

	const findings: Array<WebAddressFinding> = [];
	for (const row of rows) {
		const finding = toWebAddressFinding(row.url, httpsPolicy, {
			source: "license_url",
			sourceLabel: "License",
			recordLabel: row.name,
			entityType: null,
			entitySlug: null,
			status: null,
			socialMediaId: null,
			workingGroupReportId: null,
		});
		if (finding != null) {
			findings.push(finding);
		}
	}
	return findings;
}

async function checkEmbedBlockUrls(db: Database | Transaction): Promise<Array<WebAddressFinding>> {
	const rows = await db
		.select({
			value: schema.embedContentBlocks.url,
			title: schema.embedContentBlocks.title,
			entityType: schema.entityTypes.type,
			slug: schema.slugs.value,
			label: schema.entities.label,
			status: schema.entityStatus.type,
		})
		.from(schema.embedContentBlocks)
		.innerJoin(schema.contentBlocks, eq(schema.contentBlocks.id, schema.embedContentBlocks.id))
		.innerJoin(schema.fields, eq(schema.fields.id, schema.contentBlocks.fieldId))
		.innerJoin(schema.entityVersions, eq(schema.entityVersions.id, schema.fields.entityVersionId))
		.innerJoin(schema.entities, eq(schema.entities.id, schema.entityVersions.entityId))
		.innerJoin(schema.entityTypes, eq(schema.entityTypes.id, schema.entities.typeId))
		.innerJoin(schema.entityStatus, eq(schema.entityStatus.id, schema.entityVersions.statusId))
		.innerJoin(schema.slugs, eq(schema.slugs.entityVersionId, schema.entityVersions.id));

	const findings: Array<WebAddressFinding> = [];
	for (const row of rows) {
		const label = row.label ?? row.slug;
		const finding = toWebAddressFinding(row.value, httpsPolicy, {
			source: "embed_block_url",
			sourceLabel: "Embed block",
			// The embed's own title, plus the entity it lives on, so an editor can find it.
			recordLabel: row.title !== "" ? `${row.title} (${label})` : label,
			entityType: row.entityType,
			entitySlug: row.slug,
			status: row.status,
			socialMediaId: null,
			workingGroupReportId: null,
		});
		if (finding != null) {
			findings.push(finding);
		}
	}
	return findings;
}

async function checkWorkingGroupReportEventUrls(
	db: Database | Transaction,
): Promise<Array<WebAddressFinding>> {
	const rows = await db
		.select({
			title: schema.workingGroupReportEvents.title,
			url: schema.workingGroupReportEvents.url,
			workingGroupReportId: schema.workingGroupReportEvents.workingGroupReportId,
		})
		.from(schema.workingGroupReportEvents)
		.where(isNotNull(schema.workingGroupReportEvents.url));

	const findings: Array<WebAddressFinding> = [];
	for (const row of rows) {
		if (row.url == null) {
			continue;
		}
		const finding = toWebAddressFinding(row.url, httpsPolicy, {
			source: "working_group_report_event_url",
			sourceLabel: "Working-group report event",
			recordLabel: row.title,
			entityType: null,
			entitySlug: null,
			status: null,
			socialMediaId: null,
			workingGroupReportId: row.workingGroupReportId,
		});
		if (finding != null) {
			findings.push(finding);
		}
	}
	return findings;
}

export async function checkWebAddresses(
	db: Database | Transaction,
): Promise<WebAddressCheckResult> {
	const findings: Array<WebAddressFinding> = [];
	const errors: Array<string> = [];

	const sources: Array<() => Promise<Array<WebAddressFinding>>> = [
		() => checkSocialMediaUrls(db),
		() => checkPersonSocialMediaUrls(db),
		() => checkEventWebsites(db),
		() => checkOpportunityWebsites(db),
		() => checkDocumentPolicyUrls(db),
		() => checkLicenseUrls(db),
		() => checkEmbedBlockUrls(db),
		() => checkWorkingGroupReportEventUrls(db),
	];

	for (const run of sources) {
		try {
			findings.push(...(await run()));
		} catch (error) {
			// oxlint-disable-next-line unicorn/no-instanceof-builtins
			errors.push(error instanceof Error ? error.message : String(error));
		}
	}

	findings.sort(
		(a, b) =>
			a.sourceLabel.localeCompare(b.sourceLabel) ||
			a.recordLabel.localeCompare(b.recordLabel) ||
			a.value.localeCompare(b.value),
	);

	return { findings, errors };
}

/**
 * A `sshoc_marketplace_actor_id` maps an organisational unit onto a single actor in the SSH Open
 * Marketplace; the ingest keys owner/provider service relations off it (see
 * `@dariah-eric/sshoc-services`), so two units claiming the same actor id makes the mapping
 * ambiguous and mis-attributes relations. It is a manually entered admin field, so a collision can
 * only arise from two documents being given the same id by hand.
 */
export interface DuplicateSshocMarketplaceActorIdUnit {
	documentId: string;
	slug: string;
	label: string | null;
	type: string;
}

export interface DuplicateSshocMarketplaceActorIdFinding {
	sshocMarketplaceActorId: number;
	units: Array<DuplicateSshocMarketplaceActorIdUnit>;
}

export interface DuplicateSshocMarketplaceActorIdCheckResult {
	findings: Array<DuplicateSshocMarketplaceActorIdFinding>;
	errors: Array<string>;
}

/**
 * Resolves every organisational unit **document** whose current data carries `actorId`. The actor
 * id is stored on the version table and cloned across a document's draft/published versions, so
 * resolving each document to a single canonical version — published when one exists, else the draft
 * — collapses that fan-out to one row per document. A plain slug lookup can't do this collapsing on
 * its own any more, since a document's slug can now differ between its draft and published
 * versions. Shared by the admin-form guard (which excludes the document being edited) and
 * {@link checkDuplicateSshocMarketplaceActorIds}.
 */
export async function findOrganisationalUnitDocumentsBySshocMarketplaceActorId(
	db: Database | Transaction,
	actorId: number,
): Promise<Array<DuplicateSshocMarketplaceActorIdUnit>> {
	return db
		.select({
			documentId: schema.entities.id,
			slug: schema.slugs.value,
			label: schema.entities.label,
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
		.where(eq(schema.organisationalUnits.sshocMarketplaceActorId, actorId));
}

/**
 * Reports SSHOC marketplace actor ids claimed by more than one organisational unit document.
 * Read-only; shared by the `@dariah-eric/audit` cli and available to the admin dashboard.
 */
export async function checkDuplicateSshocMarketplaceActorIds(
	db: Database | Transaction,
): Promise<DuplicateSshocMarketplaceActorIdCheckResult> {
	const errors: Array<string> = [];

	// One row per (actor id, document): each document is resolved to a single canonical version
	// (published when one exists, else the draft), so a document with both a draft and a published
	// version is not mistaken for two claimants.
	const rows = await db
		.select({
			sshocMarketplaceActorId: schema.organisationalUnits.sshocMarketplaceActorId,
			documentId: schema.entities.id,
			slug: schema.slugs.value,
			label: schema.entities.label,
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
		.where(isNotNull(schema.organisationalUnits.sshocMarketplaceActorId));

	const unitsByActorId = new Map<number, Array<DuplicateSshocMarketplaceActorIdUnit>>();

	for (const row of rows) {
		if (row.sshocMarketplaceActorId == null) {
			continue;
		}

		const unit: DuplicateSshocMarketplaceActorIdUnit = {
			documentId: row.documentId,
			slug: row.slug,
			label: row.label,
			type: row.type,
		};

		const units = unitsByActorId.get(row.sshocMarketplaceActorId);
		if (units == null) {
			unitsByActorId.set(row.sshocMarketplaceActorId, [unit]);
		} else {
			units.push(unit);
		}
	}

	const findings: Array<DuplicateSshocMarketplaceActorIdFinding> = [];

	for (const [sshocMarketplaceActorId, units] of unitsByActorId) {
		if (units.length > 1) {
			findings.push({
				sshocMarketplaceActorId,
				units: units.toSorted((a, b) => a.slug.localeCompare(b.slug)),
			});
		}
	}

	findings.sort((a, b) => a.sshocMarketplaceActorId - b.sshocMarketplaceActorId);

	return { findings, errors };
}
