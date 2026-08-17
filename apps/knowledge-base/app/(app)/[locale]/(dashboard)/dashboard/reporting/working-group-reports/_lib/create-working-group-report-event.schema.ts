import { workingGroupEventRoleEnum } from "@dariah-eric/database/schema";
import * as v from "valibot";

export const CreateWorkingGroupReportEventActionInputSchema = v.object({
	workingGroupReportId: v.pipe(v.string(), v.uuid()),
	title: v.pipe(v.string(), v.minLength(1)),
	date: v.pipe(v.string(), v.isoDate(), v.toDate()),
	url: v.optional(v.pipe(v.string(), v.url())),
	role: v.picklist(workingGroupEventRoleEnum),
});
