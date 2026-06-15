import * as v from "valibot";

const nullableAmount = v.optional(v.pipe(v.string(), v.toNumber(), v.minValue(0)));

export const UpsertCampaignSocialMediaAmountsActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	website: nullableAmount,
	other: nullableAmount,
});
