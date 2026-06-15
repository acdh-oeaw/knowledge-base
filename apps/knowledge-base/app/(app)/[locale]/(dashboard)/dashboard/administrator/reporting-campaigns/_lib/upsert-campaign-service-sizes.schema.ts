import * as v from "valibot";

const nullableAmount = v.optional(v.pipe(v.string(), v.toNumber(), v.minValue(0)));
const nullableThreshold = v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0)));

export const UpsertCampaignServiceSizesActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	small_threshold: nullableThreshold,
	small_amount: nullableAmount,
	medium_threshold: nullableThreshold,
	medium_amount: nullableAmount,
	large_threshold: nullableThreshold,
	large_amount: nullableAmount,
	very_large_threshold: nullableThreshold,
	very_large_amount: nullableAmount,
	core_amount: nullableAmount,
});
