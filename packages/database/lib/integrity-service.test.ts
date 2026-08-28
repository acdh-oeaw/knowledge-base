import type { JSONContent } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import {
	type CountryMembershipRule,
	type DuplicateEntityRecord,
	type InactiveUnitRelationRule,
	type MutuallyExclusiveUnitRelationRule,
	type PersonRelationToUnit,
	type RelationDuration,
	type UnitDetail,
	type UnitLocation,
	buildCountryMembershipFindings,
	buildDuplicateCandidateFindings,
	buildInactiveUnitRelationFindings,
	buildMutuallyExclusiveUnitRelationFindings,
	classifyRelationPair,
	collectHeadings,
	countryMembershipRules,
	findHeadingHierarchyViolations,
	findOverlappingPeriods,
	isRelationInconsistentWithInactiveUnit,
	isUnitInactive,
	mergeAdjacentDurations,
	mutuallyExclusiveUnitRelationRules,
	normalizeIdentifier,
	normalizeName,
	normalizeUrl,
	pairedRelationRules,
	validateWebAddress,
} from "./integrity-service";

const d = (value: string): Date => new Date(value);

describe("mergeAdjacentDurations", () => {
	it("serialises a single ongoing duration with a null end", () => {
		expect(mergeAdjacentDurations([{ start: d("2025-01-01T00:00:00Z") }])).toEqual([
			{ start: "2025-01-01T00:00:00.000Z", end: null },
		]);
	});

	it("sorts durations by start", () => {
		const merged = mergeAdjacentDurations([
			{ start: d("2024-01-01T00:00:00Z"), end: d("2024-02-01T00:00:00Z") },
			{ start: d("2020-01-01T00:00:00Z"), end: d("2020-02-01T00:00:00Z") },
		]);
		expect(merged.map((interval) => interval.start)).toEqual([
			"2020-01-01T00:00:00.000Z",
			"2024-01-01T00:00:00.000Z",
		]);
	});

	it("merges consecutive terms separated by at most one day into one interval", () => {
		expect(
			mergeAdjacentDurations([
				{ start: d("2024-01-01T00:00:00Z"), end: d("2024-06-30T00:00:00Z") },
				{ start: d("2024-07-01T00:00:00Z"), end: d("2024-12-31T00:00:00Z") },
			]),
		).toEqual([{ start: "2024-01-01T00:00:00.000Z", end: "2024-12-31T00:00:00.000Z" }]);
	});

	it("keeps terms separated by more than one day as distinct intervals", () => {
		const merged = mergeAdjacentDurations([
			{ start: d("2024-01-01T00:00:00Z"), end: d("2024-06-30T00:00:00Z") },
			{ start: d("2024-07-02T00:00:01Z"), end: d("2024-12-31T00:00:00Z") },
		]);
		expect(merged).toHaveLength(2);
	});
});

describe("pairedRelationRules", () => {
	it("counts chairing or vice-chairing the NCC as a role on the committee", () => {
		const ncc = pairedRelationRules.find((rule) => rule.name === "national-coordinator-ncc");

		expect(ncc?.b.unitSlug).toBe("national-coordinator-committee");
		// Chair/vice-chair are committee roles too, so they must satisfy the committee side alongside
		// plain membership when pairing against national coordinators.
		expect(ncc?.b.roleTypes).toEqual(
			expect.arrayContaining(["is_member_of", "is_chair_of", "is_vice_chair_of"]),
		);
	});
});

describe("classifyRelationPair", () => {
	const term = [{ start: d("2025-01-01T00:00:00Z"), end: d("2025-12-31T00:00:00Z") }];
	const otherTerm = [{ start: d("2026-01-01T00:00:00Z"), end: d("2026-12-31T00:00:00Z") }];

	it("returns null when neither side has any relation", () => {
		expect(classifyRelationPair([], [])).toBeNull();
	});

	it("returns null when both sides match", () => {
		expect(classifyRelationPair(term, term)).toBeNull();
	});

	it("flags the b side missing when only a is present", () => {
		expect(classifyRelationPair(term, [])).toEqual({
			kind: "missing_counterpart",
			missingSide: "b",
		});
	});

	it("flags the a side missing when only b is present (the reverse direction)", () => {
		expect(classifyRelationPair([], term)).toEqual({
			kind: "missing_counterpart",
			missingSide: "a",
		});
	});

	it("is symmetric — swapping the sides flips which side is reported missing", () => {
		expect(classifyRelationPair(term, [])).toEqual({
			kind: "missing_counterpart",
			missingSide: "b",
		});
		expect(classifyRelationPair([], term)).toEqual({
			kind: "missing_counterpart",
			missingSide: "a",
		});
	});

	it("flags a duration mismatch when both exist but their periods differ", () => {
		expect(classifyRelationPair(term, otherTerm)).toEqual({ kind: "duration_mismatch" });
	});

	it("treats two ongoing relations with the same start as consistent", () => {
		const ongoing = [{ start: d("2025-01-01T00:00:00Z") }];
		expect(classifyRelationPair(ongoing, ongoing)).toBeNull();
	});

	it("flags a mismatch when one side is ongoing and the other has ended", () => {
		const ongoing = [{ start: d("2025-01-01T00:00:00Z") }];
		expect(classifyRelationPair(ongoing, term)).toEqual({ kind: "duration_mismatch" });
	});

	it("is consistent when split consecutive terms on one side merge to match the other", () => {
		const split = [
			{ start: d("2024-01-01T00:00:00Z"), end: d("2024-06-30T00:00:00Z") },
			{ start: d("2024-07-01T00:00:00Z"), end: d("2024-12-31T00:00:00Z") },
		];
		const continuous = [{ start: d("2024-01-01T00:00:00Z"), end: d("2024-12-31T00:00:00Z") }];
		expect(classifyRelationPair(split, continuous)).toBeNull();
	});

	it("flags a mismatch when a gap larger than the merge window remains", () => {
		const gapped = [
			{ start: d("2024-01-01T00:00:00Z"), end: d("2024-06-30T00:00:00Z") },
			{ start: d("2024-07-05T00:00:00Z"), end: d("2024-12-31T00:00:00Z") },
		];
		const continuous = [{ start: d("2024-01-01T00:00:00Z"), end: d("2024-12-31T00:00:00Z") }];
		expect(classifyRelationPair(gapped, continuous)).toEqual({ kind: "duration_mismatch" });
	});

	it("merges an NCC member term into a following chair term as one committee tenure", () => {
		// Mirrors Richard Zijdeman: is_member_of the NCC, then is_chair_of it — one day apart, so the
		// two terms merge into a single continuous committee involvement (2021-01-01 – 2028-12-31).
		const committee = [
			{ start: d("2021-01-01T00:00:00Z"), end: d("2025-12-31T00:00:00Z") },
			{ start: d("2026-01-01T00:00:00Z"), end: d("2028-12-31T00:00:00Z") },
		];
		expect(mergeAdjacentDurations(committee)).toEqual([
			{ start: "2021-01-01T00:00:00.000Z", end: "2028-12-31T00:00:00.000Z" },
		]);
	});

	it("flags a mismatch when the committee tenure is bounded but the coordinator role is open-ended", () => {
		// The remaining, legitimate Zijdeman finding: his committee roles (member + chair) end 2028,
		// but his national-coordinator relation has no end date, so the periods still do not match.
		const coordinatorOngoing = [{ start: d("2021-01-01T00:00:00Z") }];
		const committeeMemberThenChair = [
			{ start: d("2021-01-01T00:00:00Z"), end: d("2025-12-31T00:00:00Z") },
			{ start: d("2026-01-01T00:00:00Z"), end: d("2028-12-31T00:00:00Z") },
		];
		expect(classifyRelationPair(coordinatorOngoing, committeeMemberThenChair)).toEqual({
			kind: "duration_mismatch",
		});
	});
});

describe("isUnitInactive", () => {
	it("is not inactive when there are no trigger relations", () => {
		expect(isUnitInactive([])).toBe(false);
	});

	it("is inactive when its only trigger relation has ended", () => {
		expect(
			isUnitInactive([{ start: d("2020-01-01T00:00:00Z"), end: d("2024-01-01T00:00:00Z") }]),
		).toBe(true);
	});

	it("is not inactive when a trigger relation is still ongoing", () => {
		expect(isUnitInactive([{ start: d("2020-01-01T00:00:00Z") }])).toBe(false);
	});

	it("is not inactive when any of several trigger relations is still ongoing", () => {
		expect(
			isUnitInactive([
				{ start: d("2018-01-01T00:00:00Z"), end: d("2020-01-01T00:00:00Z") },
				{ start: d("2020-01-01T00:00:00Z") },
			]),
		).toBe(false);
	});

	it("is inactive when every trigger relation has ended", () => {
		expect(
			isUnitInactive([
				{ start: d("2016-01-01T00:00:00Z"), end: d("2018-01-01T00:00:00Z") },
				{ start: d("2018-01-01T00:00:00Z"), end: d("2020-01-01T00:00:00Z") },
			]),
		).toBe(true);
	});
});

describe("isRelationInconsistentWithInactiveUnit", () => {
	const unitEnd = d("2019-01-01T00:00:00Z");

	it("flags an ongoing relation", () => {
		expect(isRelationInconsistentWithInactiveUnit(null, unitEnd)).toBe(true);
	});

	it("flags a relation that ends after the unit went inactive", () => {
		expect(isRelationInconsistentWithInactiveUnit(d("2025-01-01T00:00:00Z"), unitEnd)).toBe(true);
	});

	it("does not flag a relation that ends before the unit went inactive", () => {
		expect(isRelationInconsistentWithInactiveUnit(d("2017-01-01T00:00:00Z"), unitEnd)).toBe(false);
	});

	it("does not flag a relation that ends exactly when the unit went inactive", () => {
		expect(isRelationInconsistentWithInactiveUnit(unitEnd, unitEnd)).toBe(false);
	});
});

describe("buildInactiveUnitRelationFindings", () => {
	const rule: InactiveUnitRelationRule = {
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
	};

	// A working group whose only `is_part_of` relation ended on 2019-01-01, i.e. inactive since then.
	const durationsByUnit = new Map<string, Array<RelationDuration>>([
		["wg-1", [{ start: d("2010-01-01T00:00:00Z"), end: d("2019-01-01T00:00:00Z") }]],
	]);
	const details = new Map<string, UnitDetail>([
		["wg-1", { slug: "wg-1", label: "Working Group 1", type: "working_group" }],
	]);

	const chair = (personDocumentId: string, duration: RelationDuration): PersonRelationToUnit => {
		return {
			unitDocumentId: "wg-1",
			personDocumentId,
			personSlug: `${personDocumentId}-slug`,
			personLabel: `Person ${personDocumentId}`,
			roleType: "is_chair_of",
			duration,
		};
	};

	it("flags a chair whose relation is still ongoing", () => {
		const findings = buildInactiveUnitRelationFindings(rule, durationsByUnit, details, [
			chair("p1", { start: d("2015-01-01T00:00:00Z") }),
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			personDocumentId: "p1",
			unitEnd: "2019-01-01T00:00:00.000Z",
			personRelationEnd: null,
			detail:
				'Is still an active "chair", but the working group "Working Group 1" is no longer active.',
		});
	});

	it("flags a chair whose relation ends after the working group went inactive", () => {
		// The reported bug: chair relation ends 2025 while the working group ended 2019.
		const findings = buildInactiveUnitRelationFindings(rule, durationsByUnit, details, [
			chair("p2", { start: d("2015-01-01T00:00:00Z"), end: d("2025-01-01T00:00:00Z") }),
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			personDocumentId: "p2",
			unitEnd: "2019-01-01T00:00:00.000Z",
			personRelationEnd: "2025-01-01T00:00:00.000Z",
			detail:
				'Remains a "chair" until 2025-01-01, after the working group "Working Group 1" became inactive on 2019-01-01.',
		});
	});

	it("does not flag a chair whose relation closed before the working group went inactive", () => {
		const findings = buildInactiveUnitRelationFindings(rule, durationsByUnit, details, [
			chair("p3", { start: d("2010-01-01T00:00:00Z"), end: d("2018-01-01T00:00:00Z") }),
		]);

		expect(findings).toEqual([]);
	});

	it("does not flag a chair whose relation closed exactly when the working group went inactive", () => {
		const findings = buildInactiveUnitRelationFindings(rule, durationsByUnit, details, [
			chair("p4", { start: d("2010-01-01T00:00:00Z"), end: d("2019-01-01T00:00:00Z") }),
		]);

		expect(findings).toEqual([]);
	});

	it("reports each inconsistent relation independently, keeping only the ones that outlive the unit", () => {
		const findings = buildInactiveUnitRelationFindings(rule, durationsByUnit, details, [
			chair("ongoing", { start: d("2015-01-01T00:00:00Z") }),
			chair("overruns", { start: d("2015-01-01T00:00:00Z"), end: d("2025-01-01T00:00:00Z") }),
			chair("closed", { start: d("2010-01-01T00:00:00Z"), end: d("2017-01-01T00:00:00Z") }),
		]);

		expect(findings.map((finding) => finding.personDocumentId)).toEqual(["ongoing", "overruns"]);
	});

	it("ignores relations to a unit that is still active", () => {
		const activeDurations = new Map<string, Array<RelationDuration>>([
			// An ongoing `is_part_of` relation means the working group is still active.
			["wg-1", [{ start: d("2010-01-01T00:00:00Z") }]],
		]);

		const findings = buildInactiveUnitRelationFindings(rule, activeDurations, details, [
			chair("p1", { start: d("2015-01-01T00:00:00Z") }),
		]);

		expect(findings).toEqual([]);
	});

	it("ignores inactive units whose subtype does not match the rule", () => {
		const countryDetails = new Map<string, UnitDetail>([
			["wg-1", { slug: "wg-1", label: "Some Country", type: "country" }],
		]);

		const findings = buildInactiveUnitRelationFindings(rule, durationsByUnit, countryDetails, [
			chair("p1", { start: d("2015-01-01T00:00:00Z") }),
		]);

		expect(findings).toEqual([]);
	});

	// The same logic backs the country rule, so a national coordinator whose relation outlives the
	// country's membership must be flagged just like a working-group chair.
	it("flags a national coordinator whose relation ends after the country left", () => {
		const countryRule: InactiveUnitRelationRule = {
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
		};
		// A country whose only `is_member_of` relation ended on 2019-01-01.
		const countryDurations = new Map<string, Array<RelationDuration>>([
			["c-1", [{ start: d("2005-01-01T00:00:00Z"), end: d("2019-01-01T00:00:00Z") }]],
		]);
		const countryDetails = new Map<string, UnitDetail>([
			["c-1", { slug: "c-1", label: "Country 1", type: "country" }],
		]);

		const findings = buildInactiveUnitRelationFindings(
			countryRule,
			countryDurations,
			countryDetails,
			[
				{
					unitDocumentId: "c-1",
					personDocumentId: "coordinator",
					personSlug: "coordinator-slug",
					personLabel: "The Coordinator",
					roleType: "national_coordinator",
					duration: { start: d("2015-01-01T00:00:00Z"), end: d("2025-01-01T00:00:00Z") },
				},
			],
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			rule: "inactive-country-relations-closed",
			personDocumentId: "coordinator",
			roleType: "national_coordinator",
			personRelationEnd: "2025-01-01T00:00:00.000Z",
			detail:
				'Remains a "national coordinator" until 2025-01-01, after the country "Country 1" became inactive on 2019-01-01.',
		});
	});
});

describe("findOverlappingPeriods", () => {
	it("finds no overlap when either side has no relations", () => {
		expect(findOverlappingPeriods([], [{ start: d("2020-01-01T00:00:00Z") }])).toEqual([]);
		expect(findOverlappingPeriods([{ start: d("2020-01-01T00:00:00Z") }], [])).toEqual([]);
	});

	it("finds no overlap for periods that never coincide", () => {
		// The legitimate history case: partner institution until 2015, coordinating institution
		// from 2020 — both rows are correct and must not be flagged.
		expect(
			findOverlappingPeriods(
				[{ start: d("2010-01-01T00:00:00Z"), end: d("2015-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T00:00:00Z") }],
			),
		).toEqual([]);
	});

	it("finds no overlap when one period ends exactly as the other begins", () => {
		expect(
			findOverlappingPeriods(
				[{ start: d("2010-01-01T00:00:00Z"), end: d("2020-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T00:00:00Z"), end: d("2025-01-01T00:00:00Z") }],
			),
		).toEqual([]);
	});

	it("returns the intersection of two partially overlapping periods", () => {
		expect(
			findOverlappingPeriods(
				[{ start: d("2010-01-01T00:00:00Z"), end: d("2022-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T00:00:00Z"), end: d("2025-01-01T00:00:00Z") }],
			),
		).toEqual([{ start: "2020-01-01T00:00:00.000Z", end: "2022-01-01T00:00:00.000Z" }]);
	});

	it("returns the contained period when one side encloses the other", () => {
		expect(
			findOverlappingPeriods(
				[{ start: d("2010-01-01T00:00:00Z"), end: d("2030-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T00:00:00Z"), end: d("2025-01-01T00:00:00Z") }],
			),
		).toEqual([{ start: "2020-01-01T00:00:00.000Z", end: "2025-01-01T00:00:00.000Z" }]);
	});

	it("reports an ongoing overlap with a null end when both sides are open-ended", () => {
		expect(
			findOverlappingPeriods(
				[{ start: d("2010-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T00:00:00Z") }],
			),
		).toEqual([{ start: "2020-01-01T00:00:00.000Z", end: null }]);
	});

	it("bounds the overlap by the side that has ended when the other is ongoing", () => {
		expect(
			findOverlappingPeriods(
				[{ start: d("2010-01-01T00:00:00Z"), end: d("2022-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T00:00:00Z") }],
			),
		).toEqual([{ start: "2020-01-01T00:00:00.000Z", end: "2022-01-01T00:00:00.000Z" }]);
	});

	it("merges the overlaps of consecutive rows into one continuous span", () => {
		// Two coordinating terms back to back, both inside one long partner relation.
		expect(
			findOverlappingPeriods(
				[{ start: d("2010-01-01T00:00:00Z"), end: d("2030-01-01T00:00:00Z") }],
				[
					{ start: d("2020-01-01T00:00:00Z"), end: d("2024-01-01T00:00:00Z") },
					{ start: d("2024-01-01T00:00:00Z"), end: d("2028-01-01T00:00:00Z") },
				],
			),
		).toEqual([{ start: "2020-01-01T00:00:00.000Z", end: "2028-01-01T00:00:00.000Z" }]);
	});

	it("keeps distinct overlaps separated by a gap as separate periods", () => {
		const overlaps = findOverlappingPeriods(
			[{ start: d("2010-01-01T00:00:00Z"), end: d("2030-01-01T00:00:00Z") }],
			[
				{ start: d("2012-01-01T00:00:00Z"), end: d("2014-01-01T00:00:00Z") },
				{ start: d("2020-01-01T00:00:00Z"), end: d("2022-01-01T00:00:00Z") },
			],
		);

		expect(overlaps).toEqual([
			{ start: "2012-01-01T00:00:00.000Z", end: "2014-01-01T00:00:00.000Z" },
			{ start: "2020-01-01T00:00:00.000Z", end: "2022-01-01T00:00:00.000Z" },
		]);
	});

	it("does not merge a near-adjacent gap into a manufactured overlap", () => {
		// Unlike the paired-relation checks, a sub-day gap must not be bridged here: these two
		// relations genuinely never coincide.
		expect(
			findOverlappingPeriods(
				[{ start: d("2010-01-01T00:00:00Z"), end: d("2020-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T12:00:00Z"), end: d("2025-01-01T00:00:00Z") }],
			),
		).toEqual([]);
	});
});

describe("mutuallyExclusiveUnitRelationRules", () => {
	it("infers partner-institution status from the national coordinating institution, not the reverse", () => {
		const rule = mutuallyExclusiveUnitRelationRules.find(
			(rule) => rule.name === "partner-institution-implied-by-national-coordinating-institution",
		);

		// The coordinating relation is authoritative; the partner relation is the one to remove.
		expect(rule?.kind).toBe("redundant");
		expect(rule?.a.statuses).toEqual(["is_national_coordinating_institution_in"]);
		expect(rule?.b.statuses).toEqual(["is_partner_institution_of"]);
		// Both statuses are institution -> eric relations, so both sides must be pinned to the same
		// eric: coordinating another eric would not imply being a partner of DARIAH-EU.
		expect(rule?.a.relatedUnitSlug).toBe("dariah-eu");
		expect(rule?.b.relatedUnitSlug).toBe("dariah-eu");
		expect(rule?.unitType).toBe("institution");
	});

	it("treats a cooperating partner as contradicting, not implying, the full partner statuses", () => {
		const rule = mutuallyExclusiveUnitRelationRules.find(
			(rule) => rule.name === "cooperating-partner-excludes-partner-institution",
		);

		// Neither side is authoritative here, so a human decides which one is wrong.
		expect(rule?.kind).toBe("contradictory");
		expect(rule?.a.statuses).toEqual(["is_cooperating_partner_of"]);
		expect(rule?.b.statuses).toEqual([
			"is_partner_institution_of",
			"is_national_coordinating_institution_in",
			"is_national_representative_institution_in",
		]);
		expect(rule?.unitType).toBe("institution");
	});
});

describe("buildMutuallyExclusiveUnitRelationFindings", () => {
	// `a` is the coordinating relation (authoritative), `b` the partner relation (to remove).
	const rule: MutuallyExclusiveUnitRelationRule = {
		name: "partner-institution-implied-by-national-coordinating-institution",
		unitType: "institution",
		kind: "redundant",
		a: {
			statuses: ["is_national_coordinating_institution_in"],
			relatedUnitSlug: "dariah-eu",
			label: "National coordinating institution in DARIAH-EU",
		},
		b: {
			statuses: ["is_partner_institution_of"],
			relatedUnitSlug: "dariah-eu",
			label: "Partner institution of DARIAH-EU",
		},
	};

	const details = new Map<string, UnitDetail>([
		["i-1", { slug: "institution-1", label: "Institution 1", type: "institution" }],
	]);

	const build = (
		coordinating: Array<RelationDuration>,
		partner: Array<RelationDuration>,
		unitDetails: Map<string, UnitDetail> = details,
	) =>
		buildMutuallyExclusiveUnitRelationFindings(
			rule,
			new Map([["i-1", coordinating]]),
			new Map([["i-1", partner]]),
			unitDetails,
		);

	it("flags an institution recorded as both for overlapping periods", () => {
		const findings = build(
			[{ start: d("2020-01-01T00:00:00Z") }],
			[{ start: d("2010-01-01T00:00:00Z") }],
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			rule: "partner-institution-implied-by-national-coordinating-institution",
			kind: "redundant",
			unitDocumentId: "i-1",
			unitSlug: "institution-1",
			unitLabel: "Institution 1",
			unitType: "institution",
			aLabel: "National coordinating institution in DARIAH-EU",
			bLabel: "Partner institution of DARIAH-EU",
			overlaps: [{ start: "2020-01-01T00:00:00.000Z", end: null }],
			detail:
				'Is "National coordinating institution in DARIAH-EU", which already implies "Partner institution of DARIAH-EU", but both relations are recorded for the same period. Remove the redundant "Partner institution of DARIAH-EU" relation.',
		});
	});

	it("words a contradictory rule as a conflict to resolve rather than a redundancy to remove", () => {
		const findings = buildMutuallyExclusiveUnitRelationFindings(
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
					statuses: ["is_partner_institution_of"],
					relatedUnitSlug: "dariah-eu",
					label: "Partner institution of DARIAH-EU",
				},
			},
			new Map([["i-1", [{ start: d("2020-01-01T00:00:00Z") }]]]),
			new Map([["i-1", [{ start: d("2010-01-01T00:00:00Z") }]]]),
			details,
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			kind: "contradictory",
			overlaps: [{ start: "2020-01-01T00:00:00.000Z", end: null }],
			detail:
				'Is recorded as both "Cooperating partner of DARIAH-EU" and "Partner institution of DARIAH-EU" for the same period, but these statuses are mutually exclusive. Remove whichever one is incorrect.',
		});
	});

	it("does not flag an institution whose partner period ended before it became coordinating", () => {
		const findings = build(
			[{ start: d("2020-01-01T00:00:00Z") }],
			[{ start: d("2010-01-01T00:00:00Z"), end: d("2015-01-01T00:00:00Z") }],
		);

		expect(findings).toEqual([]);
	});

	it("does not flag an institution which only has the coordinating relation", () => {
		expect(build([{ start: d("2020-01-01T00:00:00Z") }], [])).toEqual([]);
	});

	it("does not flag an institution which only has the partner relation", () => {
		expect(build([], [{ start: d("2020-01-01T00:00:00Z") }])).toEqual([]);
	});

	it("ignores a unit whose relations exist but which is not of the rule's subtype", () => {
		// A country can also be a partner of DARIAH-EU, so the subtype must be pinned.
		const countryDetails = new Map<string, UnitDetail>([
			["i-1", { slug: "country-1", label: "Country 1", type: "country" }],
		]);

		expect(
			build(
				[{ start: d("2010-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T00:00:00Z") }],
				countryDetails,
			),
		).toEqual([]);
	});

	it("ignores a unit whose subtype could not be resolved", () => {
		expect(
			build(
				[{ start: d("2010-01-01T00:00:00Z") }],
				[{ start: d("2020-01-01T00:00:00Z") }],
				new Map(),
			),
		).toEqual([]);
	});

	it("reports each overlapping unit once, with every overlapping period", () => {
		const findings = buildMutuallyExclusiveUnitRelationFindings(
			rule,
			new Map([
				["i-1", [{ start: d("2010-01-01T00:00:00Z"), end: d("2030-01-01T00:00:00Z") }]],
				["i-2", [{ start: d("2010-01-01T00:00:00Z"), end: d("2015-01-01T00:00:00Z") }]],
			]),
			new Map([
				[
					"i-1",
					[
						{ start: d("2012-01-01T00:00:00Z"), end: d("2014-01-01T00:00:00Z") },
						{ start: d("2020-01-01T00:00:00Z"), end: d("2022-01-01T00:00:00Z") },
					],
				],
				// No overlap: coordinating until 2015, partner only from 2020.
				["i-2", [{ start: d("2020-01-01T00:00:00Z") }]],
			]),
			new Map<string, UnitDetail>([
				["i-1", { slug: "institution-1", label: "Institution 1", type: "institution" }],
				["i-2", { slug: "institution-2", label: "Institution 2", type: "institution" }],
			]),
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			unitDocumentId: "i-1",
			overlaps: [
				{ start: "2012-01-01T00:00:00.000Z", end: "2014-01-01T00:00:00.000Z" },
				{ start: "2020-01-01T00:00:00.000Z", end: "2022-01-01T00:00:00.000Z" },
			],
		});
	});
});

describe("countryMembershipRules", () => {
	it("requires a member/observer country for the full partner statuses", () => {
		const rule = countryMembershipRules.find(
			(rule) => rule.name === "dariah-partner-institution-in-member-country",
		);

		expect(rule?.country.requirement).toBe("required");
		expect(rule?.trigger.statuses).toEqual([
			"is_partner_institution_of",
			"is_national_coordinating_institution_in",
			"is_national_representative_institution_in",
		]);
		expect(rule?.country.statuses).toEqual(["is_member_of", "is_observer_of"]);
		expect(rule?.trigger.unitType).toBe("institution");
	});

	it("forbids a member/observer country for cooperating partners — the mirror image", () => {
		const rule = countryMembershipRules.find(
			(rule) => rule.name === "dariah-cooperating-partner-in-non-member-country",
		);

		expect(rule?.country.requirement).toBe("forbidden");
		expect(rule?.trigger.statuses).toEqual(["is_cooperating_partner_of"]);
		expect(rule?.country.statuses).toEqual(["is_member_of", "is_observer_of"]);
	});
});

describe("buildCountryMembershipFindings", () => {
	const requiredRule: CountryMembershipRule = {
		name: "dariah-partner-institution-in-member-country",
		trigger: {
			statuses: ["is_partner_institution_of"],
			relatedUnitSlug: "dariah-eu",
			unitType: "institution",
			label: "Partner institution of DARIAH-EU",
		},
		country: {
			statuses: ["is_member_of", "is_observer_of"],
			relatedUnitSlug: "dariah-eu",
			requirement: "required",
			label: "Member or observer of DARIAH-EU",
		},
	};

	const forbiddenRule: CountryMembershipRule = {
		...requiredRule,
		name: "dariah-cooperating-partner-in-non-member-country",
		trigger: { ...requiredRule.trigger, label: "Cooperating partner of DARIAH-EU" },
		country: { ...requiredRule.country, requirement: "forbidden" },
	};

	const details = new Map<string, UnitDetail>([
		["i-1", { slug: "institution-1", label: "Institution 1", type: "institution" }],
		["c-1", { slug: "country-1", label: "Country 1", type: "country" }],
	]);

	const ongoingIn = (countryDocumentId: string, start: string): Array<UnitLocation> => [
		{ countryDocumentId, duration: { start: d(start) } },
	];

	const build = (
		rule: CountryMembershipRule,
		trigger: Array<RelationDuration>,
		locations: Array<UnitLocation>,
		countryStatus: Array<RelationDuration>,
		unitDetails: Map<string, UnitDetail> = details,
	) =>
		buildCountryMembershipFindings(
			rule,
			new Map([["i-1", trigger]]),
			new Map([["i-1", locations]]),
			new Map([["c-1", countryStatus]]),
			unitDetails,
		);

	it("does not flag a partner institution in a country that is a member throughout", () => {
		expect(
			build(
				requiredRule,
				[{ start: d("2020-01-01T00:00:00Z") }],
				ongoingIn("c-1", "2020-01-01T00:00:00Z"),
				[{ start: d("2018-01-01T00:00:00Z") }],
			),
		).toEqual([]);
	});

	it("flags the period after the country stopped being a member", () => {
		// The user's case: institution is a partner from 2020 onwards, but the country's membership
		// ended in 2021, so 2021 onwards is uncovered.
		const findings = build(
			requiredRule,
			[{ start: d("2020-01-01T00:00:00Z") }],
			ongoingIn("c-1", "2020-01-01T00:00:00Z"),
			[{ start: d("2018-01-01T00:00:00Z"), end: d("2021-01-01T00:00:00Z") }],
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			rule: "dariah-partner-institution-in-member-country",
			kind: "country_status_missing",
			unitDocumentId: "i-1",
			unitSlug: "institution-1",
			countryDocumentId: "c-1",
			countrySlug: "country-1",
			countryLabel: "Country 1",
			periods: [{ start: "2021-01-01T00:00:00.000Z", end: null }],
			detail:
				'Is "Partner institution of DARIAH-EU" while located in "Country 1", but "Country 1" is not "Member or observer of DARIAH-EU" for that entire period.',
		});
	});

	it("flags the period before the country became a member", () => {
		const findings = build(
			requiredRule,
			[{ start: d("2015-01-01T00:00:00Z"), end: d("2025-01-01T00:00:00Z") }],
			[{ countryDocumentId: "c-1", duration: { start: d("2015-01-01T00:00:00Z") } }],
			[{ start: d("2020-01-01T00:00:00Z") }],
		);

		expect(findings[0]?.periods).toEqual([
			{ start: "2015-01-01T00:00:00.000Z", end: "2020-01-01T00:00:00.000Z" },
		]);
	});

	it("flags the whole period when the country has no member or observer relation at all", () => {
		const findings = build(
			requiredRule,
			[{ start: d("2020-01-01T00:00:00Z"), end: d("2024-01-01T00:00:00Z") }],
			ongoingIn("c-1", "2020-01-01T00:00:00Z"),
			[],
		);

		expect(findings[0]?.periods).toEqual([
			{ start: "2020-01-01T00:00:00.000Z", end: "2024-01-01T00:00:00.000Z" },
		]);
	});

	it("judges the country only for the period the institution was actually located there", () => {
		// The institution left the country in 2022; the country's membership lapsing in 2023 is then
		// none of this institution's business.
		expect(
			build(
				requiredRule,
				[{ start: d("2020-01-01T00:00:00Z") }],
				[
					{
						countryDocumentId: "c-1",
						duration: { start: d("2020-01-01T00:00:00Z"), end: d("2022-01-01T00:00:00Z") },
					},
				],
				[{ start: d("2018-01-01T00:00:00Z"), end: d("2023-01-01T00:00:00Z") }],
			),
		).toEqual([]);
	});

	it("ignores a country the institution was located in outside its partner period", () => {
		expect(
			build(
				requiredRule,
				[{ start: d("2020-01-01T00:00:00Z") }],
				[
					{
						countryDocumentId: "c-1",
						duration: { start: d("2010-01-01T00:00:00Z"), end: d("2015-01-01T00:00:00Z") },
					},
				],
				[],
			),
		).toEqual([]);
	});

	it("skips an institution with no country, leaving that to the required-relations check", () => {
		const findings = buildCountryMembershipFindings(
			requiredRule,
			new Map([["i-1", [{ start: d("2020-01-01T00:00:00Z") }]]]),
			new Map(),
			new Map(),
			details,
		);

		expect(findings).toEqual([]);
	});

	it("ignores a unit which is not of the trigger's subtype", () => {
		const countryDetails = new Map<string, UnitDetail>([
			["i-1", { slug: "country-x", label: "Country X", type: "country" }],
			["c-1", { slug: "country-1", label: "Country 1", type: "country" }],
		]);

		expect(
			build(
				requiredRule,
				[{ start: d("2020-01-01T00:00:00Z") }],
				ongoingIn("c-1", "2020-01-01T00:00:00Z"),
				[],
				countryDetails,
			),
		).toEqual([]);
	});

	it("does not flag a cooperating partner in a country that is not a member", () => {
		expect(
			build(
				forbiddenRule,
				[{ start: d("2020-01-01T00:00:00Z") }],
				ongoingIn("c-1", "2020-01-01T00:00:00Z"),
				[],
			),
		).toEqual([]);
	});

	it("flags a cooperating partner in a country that is a member — the inverse rule", () => {
		const findings = build(
			forbiddenRule,
			[{ start: d("2020-01-01T00:00:00Z") }],
			ongoingIn("c-1", "2020-01-01T00:00:00Z"),
			[{ start: d("2018-01-01T00:00:00Z") }],
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			rule: "dariah-cooperating-partner-in-non-member-country",
			kind: "country_status_present",
			periods: [{ start: "2020-01-01T00:00:00.000Z", end: null }],
			detail:
				'Is "Cooperating partner of DARIAH-EU" while located in "Country 1", but "Country 1" is "Member or observer of DARIAH-EU" during that period, which this status excludes.',
		});
	});

	it("flags only the overlapping stretch when the country joined part-way through", () => {
		const findings = build(
			forbiddenRule,
			[{ start: d("2015-01-01T00:00:00Z"), end: d("2025-01-01T00:00:00Z") }],
			[{ countryDocumentId: "c-1", duration: { start: d("2015-01-01T00:00:00Z") } }],
			[{ start: d("2020-01-01T00:00:00Z") }],
		);

		expect(findings[0]?.periods).toEqual([
			{ start: "2020-01-01T00:00:00.000Z", end: "2025-01-01T00:00:00.000Z" },
		]);
	});

	it("does not flag a cooperating partner whose period merely touches the country's membership", () => {
		// Membership begins exactly when the cooperating-partner relation ends: a clean handover.
		expect(
			build(
				forbiddenRule,
				[{ start: d("2015-01-01T00:00:00Z"), end: d("2020-01-01T00:00:00Z") }],
				[{ countryDocumentId: "c-1", duration: { start: d("2015-01-01T00:00:00Z") } }],
				[{ start: d("2020-01-01T00:00:00Z") }],
			),
		).toEqual([]);
	});

	it("reports each country separately for an institution that has moved", () => {
		const findings = buildCountryMembershipFindings(
			requiredRule,
			new Map([["i-1", [{ start: d("2010-01-01T00:00:00Z") }]]]),
			new Map([
				[
					"i-1",
					[
						{
							countryDocumentId: "c-1",
							duration: { start: d("2010-01-01T00:00:00Z"), end: d("2015-01-01T00:00:00Z") },
						},
						{ countryDocumentId: "c-2", duration: { start: d("2015-01-01T00:00:00Z") } },
					],
				],
			]),
			// c-1 was never a member; c-2 is one throughout.
			new Map([["c-2", [{ start: d("2000-01-01T00:00:00Z") }]]]),
			new Map<string, UnitDetail>([
				["i-1", { slug: "institution-1", label: "Institution 1", type: "institution" }],
				["c-1", { slug: "country-1", label: "Country 1", type: "country" }],
				["c-2", { slug: "country-2", label: "Country 2", type: "country" }],
			]),
		);

		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			countryDocumentId: "c-1",
			periods: [{ start: "2010-01-01T00:00:00.000Z", end: "2015-01-01T00:00:00.000Z" }],
		});
	});
});

const heading = (level: number, text = ""): JSONContent => {
	return {
		type: "heading",
		attrs: { level },
		content: text !== "" ? [{ type: "text", text }] : [],
	};
};

describe("collectHeadings", () => {
	it("returns headings in document order with their level and trimmed text", () => {
		const doc: JSONContent = {
			type: "doc",
			content: [
				heading(2, "  Overview  "),
				{ type: "paragraph", content: [{ type: "text", text: "body" }] },
				heading(3, "Details"),
			],
		};

		expect(collectHeadings(doc)).toStrictEqual([
			{ level: 2, text: "Overview" },
			{ level: 3, text: "Details" },
		]);
	});

	it("defaults a heading with no level attribute to the top level", () => {
		const doc: JSONContent = { type: "doc", content: [{ type: "heading", content: [] }] };

		expect(collectHeadings(doc)).toStrictEqual([{ level: 2, text: "" }]);
	});

	it("returns no headings for an empty or missing document", () => {
		expect(collectHeadings(null)).toStrictEqual([]);
		expect(collectHeadings({ type: "doc" })).toStrictEqual([]);
	});
});

describe("findHeadingHierarchyViolations", () => {
	it("accepts a well-formed outline that opens at h2 and steps one level at a time", () => {
		const violations = findHeadingHierarchyViolations([
			{ level: 2, text: "A" },
			{ level: 3, text: "A.1" },
			{ level: 4, text: "A.1.a" },
			{ level: 2, text: "B" },
		]);

		expect(violations).toStrictEqual([]);
	});

	it("flags a first heading deeper than h2", () => {
		const violations = findHeadingHierarchyViolations([{ level: 3, text: "Sub" }]);

		expect(violations).toStrictEqual([
			{ kind: "does_not_start_at_top", index: 0, level: 3, previousLevel: null, text: "Sub" },
		]);
	});

	it("flags a skipped level on the way down but not moving back up", () => {
		const violations = findHeadingHierarchyViolations([
			{ level: 2, text: "A" },
			{ level: 4, text: "skips h3" },
			{ level: 2, text: "back up is fine" },
		]);

		expect(violations).toStrictEqual([
			{ kind: "skipped_level", index: 1, level: 4, previousLevel: 2, text: "skips h3" },
		]);
	});

	it("flags a level outside the allowed h2-h4 range and does not use it as a baseline", () => {
		const violations = findHeadingHierarchyViolations([
			{ level: 1, text: "page title in body" },
			{ level: 2, text: "proper top" },
			{ level: 5, text: "too deep" },
		]);

		expect(violations).toStrictEqual([
			{
				kind: "disallowed_level",
				index: 0,
				level: 1,
				previousLevel: null,
				text: "page title in body",
			},
			{ kind: "disallowed_level", index: 2, level: 5, previousLevel: 2, text: "too deep" },
		]);
	});
});

describe("normalizeName", () => {
	it("ignores case, diacritics, punctuation and word order", () => {
		expect(normalizeName("Müller, Anna")).toBe(normalizeName("Anna Muller"));
	});

	it("keeps stopwords in person names, where they are part of the surname", () => {
		expect(normalizeName("Jan de Vries")).not.toBe(normalizeName("Jan Vries"));
	});

	it("drops stopwords when asked, so leading articles do not distinguish organisations", () => {
		expect(normalizeName("The University of Vienna", true)).toBe(
			normalizeName("University Vienna", true),
		);
	});

	it("returns null when nothing comparable is left", () => {
		expect(normalizeName("   ")).toBeNull();
		expect(normalizeName(null)).toBeNull();
	});
});

describe("normalizeIdentifier", () => {
	it("compares a bare identifier equal to its url form", () => {
		expect(normalizeIdentifier("https://ror.org/03prydq77")).toBe(normalizeIdentifier("03prydq77"));
		expect(normalizeIdentifier("https://orcid.org/0000-0002-1825-0097")).toBe(
			normalizeIdentifier("0000-0002-1825-0097"),
		);
	});
});

describe("normalizeUrl", () => {
	it("ignores protocol, www, trailing slash and fragment", () => {
		expect(normalizeUrl("https://www.example.org/")).toBe(normalizeUrl("http://example.org"));
		expect(normalizeUrl("https://example.org/team#staff")).toBe(normalizeUrl("example.org/team"));
	});

	it("keeps the path and query, which distinguish two pages on one host", () => {
		expect(normalizeUrl("https://example.org/a")).not.toBe(normalizeUrl("https://example.org/b"));
		expect(normalizeUrl("https://example.org/?id=1")).not.toBe(
			normalizeUrl("https://example.org/?id=2"),
		);
	});
});

describe("buildDuplicateCandidateFindings", () => {
	const person = (
		documentId: string,
		name: string,
		rest: Partial<DuplicateEntityRecord> = {},
	): DuplicateEntityRecord => {
		return { type: "persons", documentId, slug: documentId, name, ...rest };
	};

	it("pairs two persons who share an email", () => {
		const findings = buildDuplicateCandidateFindings([
			person("a", "Anna Muller", { email: "anna@example.org" }),
			person("b", "A. Müller", { email: "ANNA@example.org " }),
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.signals).toContainEqual({ kind: "email", value: "anna@example.org" });
	});

	it("does not pair persons who share nothing", () => {
		expect(
			buildDuplicateCandidateFindings([
				person("a", "Anna Muller", { email: "anna@example.org" }),
				person("b", "Bob Smith", { email: "bob@example.org" }),
			]),
		).toStrictEqual([]);
	});

	it("accumulates every matching signal onto one pair and sums their weights", () => {
		const findings = buildDuplicateCandidateFindings([
			person("a", "Anna Muller", { email: "anna@example.org", orcid: "0000-0002-1825-0097" }),
			person("b", "Anna Muller", {
				email: "anna@example.org",
				orcid: "https://orcid.org/0000-0002-1825-0097",
			}),
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.signals.map((signal) => signal.kind)).toStrictEqual([
			"orcid",
			"email",
			"name",
		]);
		// orcid 1 + email 0.8 + name 0.7
		expect(findings[0]?.score).toBe(2.5);
	});

	it("reports the strongest signal first", () => {
		const findings = buildDuplicateCandidateFindings([
			person("a", "Anna Muller", { email: "anna@example.org" }),
			person("b", "Anna Muller", { email: "anna@example.org" }),
		]);

		expect(findings[0]?.signals[0]?.kind).toBe("email");
	});

	it("never pairs documents of different entity types", () => {
		expect(
			buildDuplicateCandidateFindings([
				person("a", "DARIAH", { email: "info@example.org" }),
				{
					type: "projects",
					documentId: "b",
					slug: "b",
					name: "DARIAH",
					email: "info@example.org",
				},
			]),
		).toStrictEqual([]);
	});

	it("pairs organisational units which share a website, ignoring url spelling", () => {
		const findings = buildDuplicateCandidateFindings([
			{
				type: "organisational_units",
				documentId: "a",
				slug: "a",
				name: "Some Institute",
				subtype: "institution",
				links: ["https://www.example.org/"],
			},
			{
				type: "organisational_units",
				documentId: "b",
				slug: "b",
				name: "Another Body",
				subtype: "institution",
				links: ["http://example.org"],
			},
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.signals).toStrictEqual([{ kind: "link", value: "example.org" }]);
	});

	it("does not treat a blank email as shared", () => {
		// Some person rows store "" rather than null, so an empty email must not pair every one of
		// them with every other.
		expect(
			buildDuplicateCandidateFindings([
				person("a", "Anna Muller", { email: "" }),
				person("b", "Bob Smith", { email: "  " }),
			]),
		).toStrictEqual([]);
	});

	it("never pairs a record with itself when it records one url twice", () => {
		expect(
			buildDuplicateCandidateFindings([
				{
					type: "organisational_units",
					documentId: "a",
					slug: "a",
					name: "Huminfra",
					links: ["https://huminfra.se", "https://www.huminfra.se/"],
				},
			]),
		).toStrictEqual([]);
	});

	it("counts a url shared with another record once, however often each records it", () => {
		const findings = buildDuplicateCandidateFindings([
			{
				type: "organisational_units",
				documentId: "a",
				slug: "a",
				name: "Huminfra",
				links: ["https://huminfra.se", "https://www.huminfra.se/"],
			},
			{
				type: "organisational_units",
				documentId: "b",
				slug: "b",
				name: "Some Consortium",
				links: ["http://huminfra.se"],
			},
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.signals).toStrictEqual([{ kind: "link", value: "huminfra.se" }]);
		expect(findings[0]?.score).toBe(0.6);
	});

	it("pairs units of different subtypes, since a duplicate may be filed under the wrong one", () => {
		const findings = buildDuplicateCandidateFindings([
			{
				type: "organisational_units",
				documentId: "a",
				slug: "a",
				name: "Austria",
				subtype: "country",
				ror: "03prydq77",
			},
			{
				type: "organisational_units",
				documentId: "b",
				slug: "b",
				name: "Austria",
				subtype: "institution",
				ror: "03prydq77",
			},
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.a.subtype).toBe("country");
	});

	it("flags a near-identical project name as similar_name, not name", () => {
		const findings = buildDuplicateCandidateFindings([
			{ type: "projects", documentId: "a", slug: "a", name: "Digital Humanities Course Registry" },
			{ type: "projects", documentId: "b", slug: "b", name: "Digital Humanities Course Registy" },
		]);

		expect(findings).toHaveLength(1);
		expect(findings[0]?.signals.map((signal) => signal.kind)).toStrictEqual(["similar_name"]);
	});

	it("does not report a shared acronym on its own, but does once a name corroborates it", () => {
		const withAcronymOnly = buildDuplicateCandidateFindings([
			{ type: "projects", documentId: "a", slug: "a", name: "Alpha One", acronym: "AO" },
			{ type: "projects", documentId: "b", slug: "b", name: "Beta Two", acronym: "ao" },
		]);

		expect(withAcronymOnly).toStrictEqual([]);

		const withSimilarName = buildDuplicateCandidateFindings([
			{ type: "projects", documentId: "a", slug: "a", name: "Alpha One Project", acronym: "AO" },
			{ type: "projects", documentId: "b", slug: "b", name: "Alpha One Projekt", acronym: "ao" },
		]);

		expect(withSimilarName).toHaveLength(1);
		expect(withSimilarName[0]?.signals.map((signal) => signal.kind)).toStrictEqual([
			"similar_name",
			"acronym",
		]);
	});

	it("honours a raised minimum score", () => {
		const records: Array<DuplicateEntityRecord> = [
			{ type: "projects", documentId: "a", slug: "a", name: "Alpha One Project" },
			{ type: "projects", documentId: "b", slug: "b", name: "Alpha One Projekt" },
		];

		expect(buildDuplicateCandidateFindings(records)).toHaveLength(1);
		expect(buildDuplicateCandidateFindings(records, 1)).toStrictEqual([]);
	});

	it("sorts findings by score, strongest pair first", () => {
		const findings = buildDuplicateCandidateFindings([
			{ type: "projects", documentId: "a", slug: "a", name: "Alpha One Project" },
			{ type: "projects", documentId: "b", slug: "b", name: "Alpha One Projekt" },
			person("c", "Anna Muller", { email: "anna@example.org", orcid: "0000-0002-1825-0097" }),
			person("d", "Anna Muller", { email: "anna@example.org", orcid: "0000-0002-1825-0097" }),
		]);

		expect(findings.map((finding) => finding.type)).toStrictEqual(["persons", "projects"]);
	});
});

describe("validateWebAddress", () => {
	const httpsOnly = { allowEmail: false };
	const emailOrHttps = { allowEmail: true };

	it("accepts an https URL", () => {
		expect(validateWebAddress("https://example.org", httpsOnly)).toBeNull();
		expect(validateWebAddress("https://example.org/path?q=1#x", httpsOnly)).toBeNull();
	});

	it("flags an http URL as insecure rather than invalid", () => {
		expect(validateWebAddress("http://example.org", httpsOnly)).toBe("insecure_scheme");
	});

	it("trims surrounding whitespace before validating", () => {
		expect(validateWebAddress("  https://example.org  ", httpsOnly)).toBeNull();
	});

	it("flags a value with no scheme as invalid", () => {
		expect(validateWebAddress("example.org", httpsOnly)).toBe("invalid");
		expect(validateWebAddress("www.example.org/path", httpsOnly)).toBe("invalid");
	});

	it("flags a non-web scheme as invalid", () => {
		expect(validateWebAddress("ftp://example.org", httpsOnly)).toBe("invalid");
	});

	it("flags an empty or unparseable value as invalid", () => {
		expect(validateWebAddress("", httpsOnly)).toBe("invalid");
		expect(validateWebAddress("   ", httpsOnly)).toBe("invalid");
		expect(validateWebAddress("not a url", httpsOnly)).toBe("invalid");
	});

	it("flags an https URL with no host as invalid", () => {
		expect(validateWebAddress("https://", httpsOnly)).toBe("invalid");
	});

	it("does not accept an email address when the policy forbids it", () => {
		expect(validateWebAddress("info@example.org", httpsOnly)).toBe("invalid");
	});

	it("accepts a bare email address when the policy allows it", () => {
		expect(validateWebAddress("info@example.org", emailOrHttps)).toBeNull();
	});

	it("accepts a mailto: link when the policy allows email", () => {
		expect(validateWebAddress("mailto:info@example.org", emailOrHttps)).toBeNull();
	});

	it("flags a malformed mailto: link as invalid", () => {
		expect(validateWebAddress("mailto:not-an-email", emailOrHttps)).toBe("invalid");
	});

	it("still requires https for URLs even when email is allowed", () => {
		expect(validateWebAddress("http://example.org", emailOrHttps)).toBe("insecure_scheme");
		expect(validateWebAddress("https://example.org", emailOrHttps)).toBeNull();
	});
});
