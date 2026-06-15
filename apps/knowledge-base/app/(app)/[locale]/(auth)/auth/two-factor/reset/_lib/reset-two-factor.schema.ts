import * as v from "valibot";

export const ResetTwoFactorActionInputSchema = v.object({
	code: v.pipe(v.string(), v.nonEmpty()),
});
