import * as v from "valibot";

export const CreateWorkingGroupReportSocialMediaActionInputSchema = v.object({
	workingGroupReportId: v.pipe(v.string(), v.uuid()),
	socialMediaId: v.pipe(v.string(), v.uuid()),
});
