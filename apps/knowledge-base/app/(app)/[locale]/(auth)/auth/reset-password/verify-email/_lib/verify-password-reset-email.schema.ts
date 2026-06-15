import * as v from "valibot";

export const VerifyPasswordResetEmailActionInputSchema = v.object({
	code: v.pipe(v.string(), v.nonEmpty()),
});
