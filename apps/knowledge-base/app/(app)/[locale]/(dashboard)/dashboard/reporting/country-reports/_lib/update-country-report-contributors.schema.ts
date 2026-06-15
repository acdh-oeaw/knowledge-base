import * as v from "valibot";

export const UpdateCountryReportContributorsActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	totalContributors: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0))),
});
