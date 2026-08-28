import * as v from "valibot";

import { countryRoleTypes } from "@/app/(app)/[locale]/(dashboard)/dashboard/administrator/guided-forms/_lib/wizard-registry";

/** Every role a paired rule may accept as a counterpart, across all of them. */
const counterpartRoleTypes = ["is_member_of", "is_chair_of", "is_vice_chair_of"] as const;

/**
 * The country-role wizard's single payload. One duration is collected and applied to both rows the
 * paired rule demands — the role in the country and the matching membership of the governance body
 * — because a duration that differs between them is exactly what `pairedRelationRules` reports.
 */
export const CreateCountryRoleActionInputSchema = v.pipe(
	v.object({
		personDocumentId: v.nullish(v.pipe(v.string(), v.uuid()), null),
		name: v.pipe(v.string(), v.nonEmpty()),
		sortName: v.pipe(v.string(), v.nonEmpty()),
		email: v.nullish(v.pipe(v.string(), v.email()), null),
		orcid: v.nullish(v.pipe(v.string(), v.nonEmpty()), null),
		countryDocumentId: v.pipe(v.string(), v.uuid()),
		roleType: v.picklist(countryRoleTypes),
		/**
		 * Which of the paired rule's accepted counterpart roles to record — chairing the National
		 * Coordinator Committee counts as being on it, so a coordinator may be recorded as chair or
		 * vice-chair instead of a plain member. Only checked to be a person role here; whether the rule
		 * in force actually accepts it is decided by `resolveCountryRoleCounterpart`, which owns that
		 * rule.
		 */
		counterpartRoleType: v.nullish(v.picklist(counterpartRoleTypes), null),
		start: v.pipe(v.string(), v.isoDate(), v.toDate()),
		end: v.nullish(v.pipe(v.string(), v.isoDate(), v.toDate()), null),
	}),
	v.forward(
		v.check(
			(input) => input.end == null || input.end > input.start,
			"The end date must be after the start date.",
		),
		["end"],
	),
);
