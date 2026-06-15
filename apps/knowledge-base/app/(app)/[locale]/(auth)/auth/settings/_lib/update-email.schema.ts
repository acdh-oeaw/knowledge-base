import * as v from "valibot";

export const UpdateEmailActionInputSchema = v.object({
	email: v.pipe(v.string(), v.email()),
});
