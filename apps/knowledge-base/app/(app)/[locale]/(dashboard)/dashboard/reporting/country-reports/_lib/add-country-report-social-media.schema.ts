import * as v from "valibot";

export const AddCountryReportSocialMediaActionInputSchema = v.object({
	countryReportId: v.pipe(v.string(), v.uuid()),
	socialMediaId: v.pipe(v.string(), v.uuid()),
});
