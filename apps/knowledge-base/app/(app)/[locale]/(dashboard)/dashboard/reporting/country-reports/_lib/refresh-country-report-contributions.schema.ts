import * as v from "valibot";

export const RefreshCountryReportContributionsActionInputSchema = v.object({
	countryReportId: v.pipe(v.string(), v.uuid()),
});
