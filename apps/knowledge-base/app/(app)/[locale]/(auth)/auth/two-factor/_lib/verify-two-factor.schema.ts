import * as v from "valibot";

export const VerifyTwoFactorActionInputSchema = v.object({
	code: v.pipe(v.string(), v.nonEmpty()),
});
