import * as v from "valibot";

export const RefreshWorkingGroupReportChairsActionInputSchema = v.object({
	workingGroupReportId: v.pipe(v.string(), v.uuid()),
});
