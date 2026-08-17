import { reportingCampaignStatusEnum } from "@dariah-eric/database/schema";
import * as v from "valibot";

export const UpdateReportingCampaignActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	year: v.pipe(v.string(), v.nonEmpty(), v.transform(Number), v.integer(), v.minValue(2000)),
	status: v.picklist(reportingCampaignStatusEnum),
});
