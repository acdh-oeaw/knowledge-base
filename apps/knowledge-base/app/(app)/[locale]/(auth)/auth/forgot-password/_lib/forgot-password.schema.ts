import * as v from "valibot";

export const ForgotPasswordActionInputSchema = v.object({
	email: v.pipe(v.string(), v.email()),
});
