import * as v from "valibot";

export const CreateCountryReportSocialMediaActionInputSchema = v.object({
	countryReportId: v.pipe(v.string(), v.uuid()),
	name: v.pipe(v.string(), v.trim(), v.nonEmpty()),
	url: v.pipe(v.string(), v.trim(), v.url()),
	typeId: v.pipe(v.string(), v.uuid()),
});
