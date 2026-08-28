import * as v from "valibot";

export const UpdateServiceStatusActionInputSchema = v.object({
	id: v.pipe(v.string(), v.uuid()),
	statusId: v.pipe(v.string(), v.uuid()),
});
