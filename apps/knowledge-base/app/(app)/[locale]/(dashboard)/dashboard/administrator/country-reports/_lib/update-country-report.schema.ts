import { reportStatusEnum } from "@acdh-knowledge-base/database/schema";
import * as v from "valibot";

export const UpdateCountryReportActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	status: v.picklist(reportStatusEnum),
});
