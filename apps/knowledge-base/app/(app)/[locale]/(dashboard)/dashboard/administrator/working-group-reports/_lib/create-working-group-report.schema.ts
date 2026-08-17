import { reportStatusEnum } from "@dariah-eric/database/schema";
import * as v from "valibot";

export const CreateWorkingGroupReportActionInputSchema = v.object({
	campaignId: v.pipe(v.string(), v.uuid()),
	workingGroupId: v.pipe(v.string(), v.uuid()),
	status: v.picklist(reportStatusEnum),
});
