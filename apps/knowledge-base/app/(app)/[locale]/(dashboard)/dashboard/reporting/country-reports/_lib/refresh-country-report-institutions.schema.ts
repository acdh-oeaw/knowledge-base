import * as v from "valibot";

export const RefreshCountryReportInstitutionsActionInputSchema = v.object({
	countryReportId: v.pipe(v.string(), v.uuid()),
});
