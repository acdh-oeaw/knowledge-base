import * as v from "valibot";

export const VerifyPasswordResetTwoFactorWithTotpActionInputSchema = v.object({
	code: v.pipe(v.string(), v.nonEmpty()),
});
