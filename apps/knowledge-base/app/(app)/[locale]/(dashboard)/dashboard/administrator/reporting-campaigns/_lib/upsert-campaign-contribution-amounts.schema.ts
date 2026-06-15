import * as v from "valibot";

const nullableAmount = v.optional(v.pipe(v.string(), v.toNumber(), v.minValue(0)));

export const UpsertCampaignContributionAmountsActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	national_coordinator: nullableAmount,
	national_coordinator_deputy: nullableAmount,
	is_chair_of_ncc: nullableAmount,
	is_chair_of_jrc: nullableAmount,
	is_chair_of_wg: nullableAmount,
	is_member_of_jrc: nullableAmount,
});
