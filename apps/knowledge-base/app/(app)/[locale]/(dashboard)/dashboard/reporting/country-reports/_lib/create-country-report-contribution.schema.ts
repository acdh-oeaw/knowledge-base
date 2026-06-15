import * as v from "valibot";

export const CreateCountryReportContributionActionInputSchema = v.object({
	countryReportId: v.pipe(v.string(), v.uuid()),
	personToOrgUnitId: v.pipe(v.string(), v.uuid()),
});
