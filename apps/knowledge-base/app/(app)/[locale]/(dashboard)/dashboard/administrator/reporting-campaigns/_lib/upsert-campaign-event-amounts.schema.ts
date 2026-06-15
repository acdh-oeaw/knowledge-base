import * as v from "valibot";

const nullableAmount = v.optional(v.pipe(v.string(), v.toNumber(), v.minValue(0)));

export const UpsertCampaignEventAmountsActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	small: nullableAmount,
	medium: nullableAmount,
	large: nullableAmount,
	very_large: nullableAmount,
	dariah_commissioned: nullableAmount,
});
