import * as v from "valibot";

export const UpsertCampaignCountryThresholdsActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	amounts: v.optional(
		v.record(v.pipe(v.string(), v.uuid()), v.pipe(v.string(), v.toNumber(), v.minValue(0))),
	),
});
