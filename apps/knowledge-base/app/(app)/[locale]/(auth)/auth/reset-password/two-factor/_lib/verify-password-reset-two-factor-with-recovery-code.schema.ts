import * as v from "valibot";

export const VerifyPasswordResetTwoFactorWithRecoveryCodeActionInputSchema = v.object({
	code: v.pipe(v.string(), v.nonEmpty()),
});
