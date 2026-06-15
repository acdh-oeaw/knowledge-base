import * as v from "valibot";

export const VerifyEmailActionInputSchema = v.object({
	code: v.pipe(v.string(), v.nonEmpty()),
});
