import * as v from "valibot";

export const AddCountryReportServiceActionInputSchema = v.object({
	countryReportId: v.pipe(v.string(), v.uuid()),
	serviceId: v.pipe(v.string(), v.uuid()),
});
