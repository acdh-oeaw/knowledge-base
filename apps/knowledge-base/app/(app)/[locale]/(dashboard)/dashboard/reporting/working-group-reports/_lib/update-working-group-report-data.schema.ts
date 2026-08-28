import * as v from "valibot";

export const UpdateWorkingGroupReportDataActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	numberOfMembers: v.optional(v.pipe(v.string(), v.toNumber(), v.integer(), v.minValue(0))),
});
